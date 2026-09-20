from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
import jwt

from app.core.config import get_settings

TokenKind = Literal["access", "refresh", "reset", "verify"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def random_code(length: int = 8) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def create_token(subject: uuid.UUID | str, kind: TokenKind, expires_delta: timedelta, **claims: object) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(subject),
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": secrets.token_hex(8),
        **claims,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    return create_token(user_id, "access", timedelta(minutes=get_settings().access_token_minutes), role=role)


def create_refresh_token(user_id: uuid.UUID) -> str:
    return create_token(user_id, "refresh", timedelta(days=get_settings().refresh_token_days))


class TokenError(Exception):
    pass


def decode_token(token: str, expected_kind: TokenKind) -> dict[str, object]:
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError("invalid_token") from exc
    if payload.get("kind") != expected_kind:
        raise TokenError("wrong_token_kind")
    return payload
