from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, TZDateTime, UUIDMixin


class PlanCode(str, enum.Enum):
    FREE = "FREE"
    WEEKLY = "WEEKLY"
    PRO = "PRO"


class SubscriptionStatus(str, enum.Enum):
    FREE = "FREE"
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    REFUNDED = "REFUNDED"


class PaymentProviderName(str, enum.Enum):
    MTN = "MTN"
    AIRTEL = "AIRTEL"
    DEMO = "DEMO"


class SubscriptionPlan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "subscription_plans"

    code: Mapped[PlanCode] = mapped_column(Enum(PlanCode, name="plan_code"), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    price_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="UGX", nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    daily_simulations: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    max_scenarios: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    ai_depth: Mapped[str] = mapped_column(String(16), default="basic", nullable=False)
    custom_what_if: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    advanced_insights: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    history_limit: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Subscription(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("subscription_plans.id"), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus, name="subscription_status"), default=SubscriptionStatus.ACTIVE, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(TZDateTime(), index=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    payment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("payments.id", ondelete="SET NULL"))
    expiry_notified_at: Mapped[datetime | None] = mapped_column(TZDateTime())


class Payment(UUIDMixin, TimestampMixin, Base):
    """A payment attempt. Never stores PINs or any Mobile Money security codes."""

    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_payments_user_idempotency"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("subscription_plans.id"), nullable=False)
    provider: Mapped[PaymentProviderName] = mapped_column(Enum(PaymentProviderName, name="payment_provider"), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.PENDING, nullable=False, index=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="UGX", nullable=False)
    payer_phone_masked: Mapped[str] = mapped_column(String(24), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(128), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(255))
    verified_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    expires_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
    provider_payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)


class UsageRecord(UUIDMixin, Base):
    """One row per user per day per action; PostgreSQL is the source of truth, Redis is a cache."""

    __tablename__ = "usage_records"
    __table_args__ = (UniqueConstraint("user_id", "day", "action", name="uq_usage_user_day_action"),)

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
