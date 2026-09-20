"""Plans, subscription state and usage enforcement. All limits are enforced here, server-side."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import Cache, get_cache
from app.core.config import Settings, get_settings
from app.db.base import utcnow
from app.models import (
    NotificationType,
    PlanCode,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageRecord,
    User,
)
from app.services.notifications import notify

SIMULATION_ACTION = "simulation"

DEFAULT_PLANS: list[dict[str, object]] = [
    {
        "code": PlanCode.FREE,
        "name": "Free",
        "description": "5 introductory simulations, then 3 per day. Seeded scenarios and rule-based insights.",
        "price_minor": 0,
        "duration_days": 0,
        "daily_simulations": 3,
        "max_scenarios": 3,
        "ai_depth": "basic",
        "custom_what_if": False,
        "advanced_insights": False,
        "history_limit": 10,
        "sort_order": 0,
    },
    {
        "code": PlanCode.WEEKLY,
        "name": "FORK Weekly",
        "description": "Seven days of deeper simulations, free-text what-ifs and AI explanations.",
        "price_minor": 3000,
        "duration_days": 7,
        "daily_simulations": 30,
        "max_scenarios": 4,
        "ai_depth": "full",
        "custom_what_if": True,
        "advanced_insights": True,
        "history_limit": 500,
        "sort_order": 1,
    },
    {
        "code": PlanCode.PRO,
        "name": "FORK Pro",
        "description": "A month of the full FORK experience, including pattern insights and richer scenarios.",
        "price_minor": 10000,
        "duration_days": 30,
        "daily_simulations": 60,
        "max_scenarios": 4,
        "ai_depth": "full",
        "custom_what_if": True,
        "advanced_insights": True,
        "history_limit": 5000,
        "sort_order": 2,
    },
]


def ensure_default_plans(db: Session, settings: Settings | None = None) -> list[SubscriptionPlan]:
    """Create the three plans if missing. Prices come from env so they are configurable."""
    settings = settings or get_settings()
    existing = {p.code: p for p in db.scalars(select(SubscriptionPlan))}
    prices = {PlanCode.WEEKLY: settings.weekly_price_ugx, PlanCode.PRO: settings.pro_monthly_price_ugx}
    for spec in DEFAULT_PLANS:
        code = spec["code"]
        assert isinstance(code, PlanCode)
        if code in existing:
            continue
        plan = SubscriptionPlan(**spec, currency=settings.currency)
        if code in prices:
            plan.price_minor = prices[code]
        if code == PlanCode.FREE:
            plan.daily_simulations = settings.free_daily_simulations
        db.add(plan)
        existing[code] = plan
    db.commit()
    return sorted(existing.values(), key=lambda p: p.sort_order)


def get_plan(db: Session, code: PlanCode) -> SubscriptionPlan:
    plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == code))
    if plan is None:
        ensure_default_plans(db)
        plan = db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.code == code))
    assert plan is not None
    return plan


def list_plans(db: Session) -> list[SubscriptionPlan]:
    plans = list(db.scalars(select(SubscriptionPlan).where(SubscriptionPlan.is_active).order_by(SubscriptionPlan.sort_order)))
    return plans or ensure_default_plans(db)


def active_subscription(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> Subscription | None:
    now = now or utcnow()
    stmt = (
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.starts_at <= now,
            (Subscription.ends_at.is_(None)) | (Subscription.ends_at > now),
        )
        .order_by(Subscription.ends_at.desc().nullsfirst())
    )
    return db.scalars(stmt).first()


def activate_subscription(db: Session, user: User, plan: SubscriptionPlan, payment_id: uuid.UUID | None, now: datetime | None = None) -> Subscription:
    """Start (or extend) a paid subscription. Only called after a payment is verified."""
    now = now or utcnow()
    current = active_subscription(db, user.id, now)
    start = now
    if current and current.plan_id == plan.id and current.ends_at and current.ends_at > now:
        start = current.ends_at
        current.status = SubscriptionStatus.CANCELLED
        current.cancelled_at = now
        end = current.ends_at + timedelta(days=plan.duration_days)
    else:
        end = now + timedelta(days=plan.duration_days)
    sub = Subscription(user_id=user.id, plan_id=plan.id, status=SubscriptionStatus.ACTIVE, starts_at=start, ends_at=end, payment_id=payment_id)
    db.add(sub)
    notify(
        db,
        user.id,
        NotificationType.SUBSCRIPTION,
        f"{plan.name} is active",
        f"Your subscription is active until {end:%d %b %Y}. Thank you for supporting FORK.",
        link="/app/settings/subscription",
    )
    db.commit()
    db.refresh(sub)
    return sub


def expire_subscriptions(db: Session, now: datetime | None = None) -> int:
    """Background job: mark ended subscriptions EXPIRED and warn users about upcoming expiry."""
    now = now or utcnow()
    ended = list(db.scalars(select(Subscription).where(Subscription.status == SubscriptionStatus.ACTIVE, Subscription.ends_at <= now)))
    for sub in ended:
        sub.status = SubscriptionStatus.EXPIRED
        notify(
            db,
            sub.user_id,
            NotificationType.SUBSCRIPTION,
            "Your FORK subscription has ended",
            "You're back on the Free plan. Your decisions and history are safe.",
            link="/app/pricing",
        )
    soon = now + timedelta(days=1)
    expiring = list(
        db.scalars(
            select(Subscription).where(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.ends_at > now,
                Subscription.ends_at <= soon,
                Subscription.expiry_notified_at.is_(None),
            )
        )
    )
    for sub in expiring:
        plan = db.get(SubscriptionPlan, sub.plan_id)
        sub.expiry_notified_at = now
        notify(
            db,
            sub.user_id,
            NotificationType.SUBSCRIPTION,
            f"Your {plan.name if plan else 'FORK'} subscription expires soon",
            "Renew to keep deeper simulations and AI explanations.",
            link="/app/pricing",
        )
    db.commit()
    return len(ended)


@dataclass
class UsageSnapshot:
    plan_code: PlanCode
    plan_name: str
    status: SubscriptionStatus
    subscription_ends_at: datetime | None
    trial_remaining: int
    daily_limit: int
    daily_used: int
    resets_at: datetime
    max_scenarios: int
    ai_depth: str
    custom_what_if: bool
    advanced_insights: bool
    history_limit: int

    @property
    def remaining_today(self) -> int:
        return max(self.daily_limit - self.daily_used, 0)

    @property
    def can_simulate(self) -> bool:
        return self.trial_remaining > 0 or self.remaining_today > 0


def _today() -> date:
    return datetime.now(UTC).date()


def _next_reset() -> datetime:
    tomorrow = _today() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=UTC)


def _usage_row(db: Session, user_id: uuid.UUID, action: str, day: date) -> UsageRecord | None:
    return db.scalar(select(UsageRecord).where(UsageRecord.user_id == user_id, UsageRecord.day == day, UsageRecord.action == action))


def daily_used(db: Session, cache: Cache, user_id: uuid.UUID, action: str = SIMULATION_ACTION) -> int:
    day = _today()
    key = f"usage:{user_id}:{action}:{day.isoformat()}"
    cached = cache.get(key)
    if cached is not None:
        return int(cached)
    row = _usage_row(db, user_id, action, day)
    count = row.count if row else 0
    cache.set(key, str(count), ex=86400)
    return count


def snapshot(db: Session, user: User, cache: Cache | None = None) -> UsageSnapshot:
    cache = cache or get_cache()
    sub = active_subscription(db, user.id)
    plan = db.get(SubscriptionPlan, sub.plan_id) if sub else get_plan(db, PlanCode.FREE)
    assert plan is not None
    if sub:
        status = SubscriptionStatus.ACTIVE
    elif user.trial_simulations_remaining > 0:
        status = SubscriptionStatus.TRIAL
    else:
        status = SubscriptionStatus.FREE
    return UsageSnapshot(
        plan_code=plan.code,
        plan_name=plan.name,
        status=status,
        subscription_ends_at=sub.ends_at if sub else None,
        trial_remaining=user.trial_simulations_remaining if plan.code == PlanCode.FREE else 0,
        daily_limit=plan.daily_simulations,
        daily_used=daily_used(db, cache, user.id),
        resets_at=_next_reset(),
        max_scenarios=plan.max_scenarios,
        ai_depth=plan.ai_depth,
        custom_what_if=plan.custom_what_if,
        advanced_insights=plan.advanced_insights,
        history_limit=plan.history_limit,
    )


class UsageLimitReached(Exception):
    def __init__(self, snap: UsageSnapshot) -> None:
        super().__init__("usage_limit_reached")
        self.snapshot = snap


def consume_simulation(db: Session, user: User, cache: Cache | None = None) -> UsageSnapshot:
    """Spend one trial if available, otherwise one daily slot. Raises UsageLimitReached."""
    cache = cache or get_cache()
    snap = snapshot(db, user, cache)
    if not snap.can_simulate:
        raise UsageLimitReached(snap)

    if snap.plan_code == PlanCode.FREE and user.trial_simulations_remaining > 0:
        user.trial_simulations_remaining -= 1
        if user.trial_simulations_remaining == 0:
            notify(
                db,
                user.id,
                NotificationType.TRIAL,
                "Your 5 trial simulations are used",
                "You now have 3 free simulations every day. Ready to explore deeper? Weekly access is UGX 3,000.",
                link="/app/pricing",
            )
        db.commit()
        return snapshot(db, user, cache)

    day = _today()
    row = _usage_row(db, user.id, SIMULATION_ACTION, day)
    if row is None:
        row = UsageRecord(user_id=user.id, day=day, action=SIMULATION_ACTION, count=0, updated_at=utcnow())
        db.add(row)
    row.count += 1
    row.updated_at = utcnow()
    db.commit()
    cache.set(f"usage:{user.id}:{SIMULATION_ACTION}:{day.isoformat()}", str(row.count), ex=86400)
    return snapshot(db, user, cache)
