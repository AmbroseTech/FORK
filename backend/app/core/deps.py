from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.cache import Cache, get_cache
from app.core.config import Settings, get_settings
from app.core.security import TokenError, decode_token
from app.db.session import get_db
from app.models import User, UserRole

bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
CacheDep = Annotated[Cache, Depends(get_cache)]


def get_current_user(
    db: DB,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = decode_token(credentials.credentials, "access")
        user_id = uuid.UUID(str(payload["sub"]))
    except (TokenError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please sign in again.") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account unavailable")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def require_moderator(user: CurrentUser) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Moderator access required")
    return user


def rate_limit(scope: str, per_minute: int | None = None):
    """Per-IP (or per-user) sliding-minute rate limit backed by Redis."""

    def dependency(request: Request, cache: CacheDep, settings: SettingsDep) -> None:
        limit = settings.auth_rate_limit_per_minute if scope == "auth" else (per_minute or settings.rate_limit_per_minute)
        ident = request.client.host if request.client else "anon"
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            ident = f"tok:{auth[-24:]}"
        key = f"rl:{scope}:{ident}"
        count = cache.incr(key, ex=60)
        if count > limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests. Please slow down.")

    return Depends(dependency)


def client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host if request.client else None
