from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text

from app.core.deps import DB, CacheDep, CurrentUser, SettingsDep, require_admin
from app.models import Decision, Payment, PaymentStatus, Subscription, SubscriptionStatus, User
from app.services import notifications as notif

router = APIRouter(tags=["misc"])


# ---- health -----------------------------------------------------------------


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def ready(db: DB, cache: CacheDep, settings: SettingsDep) -> dict[str, object]:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "redis": cache.healthy(),
        "ai_provider": "demo" if settings.demo_mode else settings.ai_provider,
        "payments_demo": settings.payments_demo,
        "version": settings.app_version,
    }


# ---- notifications -------------------------------------------------------------


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    body: str
    link: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


@router.get("/api/notifications", response_model=NotificationList)
def list_notifications(db: DB, user: CurrentUser) -> NotificationList:
    items = notif.list_notifications(db, user.id)
    return NotificationList(items=[NotificationOut.model_validate(n) for n in items], unread=notif.unread_count(db, user.id))


@router.post("/api/notifications/read-all", response_model=NotificationList)
def read_all(db: DB, user: CurrentUser) -> NotificationList:
    notif.mark_read(db, user.id)
    return list_notifications(db, user)


@router.post("/api/notifications/{notification_id}/read", response_model=NotificationList)
def read_one(notification_id: uuid.UUID, db: DB, user: CurrentUser) -> NotificationList:
    notif.mark_read(db, user.id, notification_id)
    return list_notifications(db, user)


# ---- admin ----------------------------------------------------------------------


class AdminOverview(BaseModel):
    users: int
    active_subscriptions: int
    decisions: int
    payments_success: int
    payments_failed: int
    revenue_minor: int
    currency: str


@router.get("/api/admin/overview", response_model=AdminOverview, dependencies=[Depends(require_admin)])
def admin_overview(db: DB) -> AdminOverview:
    count = lambda stmt: int(db.scalar(stmt) or 0)  # noqa: E731
    return AdminOverview(
        users=count(select(func.count()).select_from(User).where(User.deleted_at.is_(None))),
        active_subscriptions=count(select(func.count()).select_from(Subscription).where(Subscription.status == SubscriptionStatus.ACTIVE)),
        decisions=count(select(func.count()).select_from(Decision).where(Decision.deleted_at.is_(None))),
        payments_success=count(select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.SUCCESS)),
        payments_failed=count(select(func.count()).select_from(Payment).where(Payment.status == PaymentStatus.FAILED)),
        revenue_minor=count(
            select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(Payment.status == PaymentStatus.SUCCESS, Payment.is_demo.is_(False))
        ),
        currency="UGX",
    )
