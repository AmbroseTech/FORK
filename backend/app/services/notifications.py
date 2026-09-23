from __future__ import annotations

import uuid
from typing import Any, cast

from sqlalchemy import CursorResult, func, select, update
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.models import Notification, NotificationType


def notify(
    db: Session,
    user_id: uuid.UUID,
    type_: NotificationType,
    title: str,
    body: str = "",
    link: str | None = None,
    data: dict[str, object] | None = None,
) -> Notification:
    n = Notification(user_id=user_id, type=type_, title=title, body=body, link=link, data=data or {}, created_at=utcnow())
    db.add(n)
    return n


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    return int(db.scalar(stmt) or 0)


def list_notifications(db: Session, user_id: uuid.UUID, limit: int = 50) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID | None = None) -> int:
    stmt = update(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    if notification_id is not None:
        stmt = stmt.where(Notification.id == notification_id)
    result = db.execute(stmt.values(read_at=utcnow()))
    db.commit()
    return int(cast(CursorResult[Any], result).rowcount or 0)
