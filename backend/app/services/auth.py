from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.core.cache import Cache
from app.core.config import Settings
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    random_code,
    random_token,
    sha256,
    verify_password,
)
from app.db.base import utcnow
from app.models import AuditLog, NotificationType, Profile, Referral, Session, TermsAcceptance, User
from app.schemas.auth import SignupRequest, TokenPair
from app.services.notifications import notify

log = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def audit(db: DBSession, actor_id: uuid.UUID | None, action: str, target: object = None, **meta: object) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=type(target).__name__ if target is not None else None,
            target_id=str(getattr(target, "id", "")) if target is not None else None,
            metadata_=meta,
            created_at=utcnow(),
        )
    )


def _unique_referral_code(db: DBSession) -> str:
    while True:
        code = random_code(8)
        if db.scalar(select(User.id).where(User.referral_code == code)) is None:
            return code


def signup(db: DBSession, cache: Cache, req: SignupRequest, settings: Settings, ip: str | None, user_agent: str | None) -> tuple[User, TokenPair, str | None]:
    email = req.email.lower().strip()
    if db.scalar(select(User.id).where(User.email == email)):
        raise AuthError("An account with this email already exists", 409)
    if db.scalar(select(User.id).where(User.username == req.username)):
        raise AuthError("That username is taken", 409)

    referrer: User | None = None
    if req.referral_code:
        referrer = db.scalar(select(User).where(User.referral_code == req.referral_code.strip().upper()))

    user = User(
        email=email,
        username=req.username,
        password_hash=hash_password(req.password),
        trial_simulations_remaining=settings.trial_simulations,
        referral_code=_unique_referral_code(db),
        referred_by_id=referrer.id if referrer else None,
    )
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id, display_name=req.display_name.strip() or req.username))
    db.add(TermsAcceptance(user_id=user.id, terms_version=settings.terms_version, accepted_at=utcnow(), ip_address=ip))
    if referrer:
        db.add(Referral(referrer_id=referrer.id, referred_id=user.id, status="SIGNED_UP"))
        notify(
            db,
            referrer.id,
            NotificationType.REFERRAL,
            "Someone joined FORK with your link",
            f"@{user.username} signed up using your referral code.",
        )
    audit(db, user.id, "auth.signup", user, ip=ip)

    tokens = _issue_tokens(db, user, settings, ip, user_agent)
    db.commit()
    db.refresh(user)
    dev_verify_token = start_email_verification(cache, user, settings)
    return user, tokens, dev_verify_token


def _issue_tokens(db: DBSession, user: User, settings: Settings, ip: str | None, user_agent: str | None) -> TokenPair:
    refresh = create_refresh_token(user.id)
    db.add(
        Session(
            user_id=user.id,
            token_hash=sha256(refresh),
            user_agent=(user_agent or "")[:255] or None,
            ip_address=ip,
            expires_at=utcnow() + timedelta(days=settings.refresh_token_days),
        )
    )
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=refresh,
        expires_in=settings.access_token_minutes * 60,
    )


def login(db: DBSession, email: str, password: str, settings: Settings, ip: str | None, user_agent: str | None) -> tuple[User, TokenPair]:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Incorrect email or password", 401)
    if not user.is_active or user.deleted_at is not None:
        raise AuthError("This account is disabled", 403)
    user.last_login_at = utcnow()
    tokens = _issue_tokens(db, user, settings, ip, user_agent)
    audit(db, user.id, "auth.login", user, ip=ip)
    db.commit()
    return user, tokens


def refresh(db: DBSession, refresh_token: str, settings: Settings, ip: str | None, user_agent: str | None) -> tuple[User, TokenPair]:
    try:
        payload = decode_token(refresh_token, "refresh")
        user_id = uuid.UUID(str(payload["sub"]))
    except (TokenError, KeyError, ValueError) as exc:
        raise AuthError("Session expired. Please sign in again.", 401) from exc
    session = db.scalar(select(Session).where(Session.token_hash == sha256(refresh_token)))
    now = utcnow()
    if session is None or session.revoked_at is not None or session.expires_at < now or session.user_id != user_id:
        raise AuthError("Session expired. Please sign in again.", 401)
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise AuthError("Account unavailable", 401)
    session.revoked_at = now  # rotate
    tokens = _issue_tokens(db, user, settings, ip, user_agent)
    db.commit()
    return user, tokens


def logout(db: DBSession, refresh_token: str | None, user: User | None) -> None:
    now = utcnow()
    if refresh_token:
        session = db.scalar(select(Session).where(Session.token_hash == sha256(refresh_token)))
        if session and session.revoked_at is None:
            session.revoked_at = now
    if user is not None:
        audit(db, user.id, "auth.logout", user)
    db.commit()


def logout_all(db: DBSession, user: User) -> int:
    now = utcnow()
    sessions = list(db.scalars(select(Session).where(Session.user_id == user.id, Session.revoked_at.is_(None))))
    for s in sessions:
        s.revoked_at = now
    db.commit()
    return len(sessions)


# --- Password reset & email verification (state kept in Redis; PostgreSQL never stores raw tokens) ---


def start_password_reset(db: DBSession, cache: Cache, email: str, settings: Settings) -> str | None:
    """Always returns quietly to avoid leaking whether the email exists. Returns the token only in dev."""
    user = db.scalar(select(User).where(User.email == email.lower().strip()))
    if user is None:
        return None
    token = random_token()
    cache.set(f"reset:{sha256(token)}", str(user.id), ex=settings.reset_token_minutes * 60)
    audit(db, user.id, "auth.reset_requested", user)
    db.commit()
    # Email delivery is pluggable; in dev/demo the token is returned to the API caller.
    log.info("Password reset requested for user %s", user.id)
    return token if settings.is_dev else None


def complete_password_reset(db: DBSession, cache: Cache, token: str, new_password: str) -> User:
    key = f"reset:{sha256(token)}"
    user_id = cache.get(key)
    if not user_id:
        raise AuthError("This reset link is invalid or has expired", 400)
    user = db.get(User, uuid.UUID(user_id))
    if user is None:
        raise AuthError("Account not found", 404)
    user.password_hash = hash_password(new_password)
    cache.delete(key)
    logout_all(db, user)
    audit(db, user.id, "auth.reset_completed", user)
    db.commit()
    return user


def change_password(db: DBSession, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise AuthError("Current password is incorrect", 400)
    user.password_hash = hash_password(new)
    audit(db, user.id, "auth.password_changed", user)
    db.commit()


def start_email_verification(cache: Cache, user: User, settings: Settings) -> str | None:
    token = random_token()
    cache.set(f"verify:{sha256(token)}", str(user.id), ex=settings.verify_token_hours * 3600)
    return token if settings.is_dev else None


def complete_email_verification(db: DBSession, cache: Cache, token: str) -> User:
    key = f"verify:{sha256(token)}"
    user_id = cache.get(key)
    if not user_id:
        raise AuthError("This verification link is invalid or has expired", 400)
    user = db.get(User, uuid.UUID(user_id))
    if user is None:
        raise AuthError("Account not found", 404)
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
        audit(db, user.id, "auth.email_verified", user)
    cache.delete(key)
    db.commit()
    return user
