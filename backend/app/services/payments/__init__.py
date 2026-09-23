"""PaymentService: state machine, idempotency, verification, webhooks and reconciliation.

A subscription is activated ONLY when a payment reaches SUCCESS through provider
verification or a signature-checked webhook (or, in the clearly-labelled demo
provider, an explicit "simulate approval" action)."""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.base import utcnow
from app.models import NotificationType, Payment, PaymentProviderName, PaymentStatus, PlanCode, SubscriptionPlan, User
from app.services.auth import audit
from app.services.notifications import notify
from app.services.payments.providers import (
    PaymentProvider,
    PaymentProviderError,
    WebhookEvent,
    build_provider,
    mask_phone,
    normalize_phone,
)
from app.services.subscriptions import activate_subscription, get_plan

__all__ = ["PaymentError", "PaymentProviderError", "PaymentService", "WebhookEvent"]

log = logging.getLogger(__name__)

TERMINAL = {PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED, PaymentStatus.REFUNDED}
ALLOWED_TRANSITIONS: dict[PaymentStatus, set[PaymentStatus]] = {
    PaymentStatus.PENDING: {
        PaymentStatus.PROCESSING,
        PaymentStatus.SUCCESS,
        PaymentStatus.FAILED,
        PaymentStatus.CANCELLED,
        PaymentStatus.EXPIRED,
    },
    PaymentStatus.PROCESSING: {PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED},
    PaymentStatus.SUCCESS: {PaymentStatus.REFUNDED},
    PaymentStatus.FAILED: set(),
    PaymentStatus.CANCELLED: set(),
    PaymentStatus.EXPIRED: set(),
    PaymentStatus.REFUNDED: set(),
}


class PaymentError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class PaymentService:
    def __init__(self, db: Session, settings: Settings | None = None) -> None:
        self.db = db
        self.settings = settings or get_settings()

    def provider_for(self, name: PaymentProviderName) -> PaymentProvider:
        return build_provider(name, self.settings)

    # ---- initiation -----------------------------------------------------------

    def initiate(self, user: User, plan_code: PlanCode, provider_name: PaymentProviderName, phone: str, idempotency_key: str) -> tuple[Payment, str]:
        if plan_code == PlanCode.FREE:
            raise PaymentError("The Free plan does not need a payment")
        if provider_name not in (PaymentProviderName.MTN, PaymentProviderName.AIRTEL):
            raise PaymentError("Only MTN and Airtel Mobile Money are available right now. Cards are coming soon.")

        existing = self.db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.idempotency_key == idempotency_key))
        if existing:
            return existing, "This payment was already started."

        plan = get_plan(self.db, plan_code)
        msisdn = normalize_phone(phone)
        provider = self.provider_for(provider_name)
        now = utcnow()
        payment = Payment(
            user_id=user.id,
            plan_id=plan.id,
            provider=provider_name,
            status=PaymentStatus.PENDING,
            amount_minor=plan.price_minor,
            currency=plan.currency,
            payer_phone_masked=mask_phone(msisdn),
            idempotency_key=idempotency_key,
            is_demo=provider.is_demo,
            expires_at=now + timedelta(minutes=self.settings.payment_expiry_minutes),
        )
        self.db.add(payment)
        self.db.flush()
        try:
            result = provider.initiate(payment.id, plan.price_minor, plan.currency, msisdn, f"FORK {plan.name}")
        except PaymentProviderError as exc:
            payment.status = PaymentStatus.FAILED
            payment.failure_reason = str(exc)[:255]
            self.db.commit()
            raise PaymentError(str(exc), 502) from exc
        payment.provider_reference = result.provider_reference
        payment.provider_payload = result.payload
        self._transition(payment, result.status)
        audit(self.db, user.id, "payment.initiated", payment, provider=provider_name.value, demo=provider.is_demo)
        self.db.commit()
        self.db.refresh(payment)
        return payment, result.instructions

    # ---- state machine --------------------------------------------------------

    def _transition(self, payment: Payment, new_status: PaymentStatus, reason: str | None = None) -> bool:
        if payment.status == new_status:
            return False
        if new_status not in ALLOWED_TRANSITIONS[payment.status]:
            log.warning("Ignored illegal payment transition %s -> %s (%s)", payment.status, new_status, payment.id)
            return False
        payment.status = new_status
        if reason:
            payment.failure_reason = reason[:255]
        if new_status == PaymentStatus.SUCCESS:
            payment.verified_at = utcnow()
            self._on_success(payment)
        elif new_status in (PaymentStatus.FAILED, PaymentStatus.EXPIRED, PaymentStatus.CANCELLED):
            notify(
                self.db,
                payment.user_id,
                NotificationType.PAYMENT,
                f"Payment {new_status.value.lower()}",
                reason or "The payment did not complete. No money was taken. You can try again any time.",
                link="/app/pricing",
            )
        return True

    def _on_success(self, payment: Payment) -> None:
        user = self.db.get(User, payment.user_id)
        plan = self.db.get(SubscriptionPlan, payment.plan_id)
        if user is None or plan is None:
            return
        activate_subscription(self.db, user, plan, payment.id)
        notify(
            self.db,
            user.id,
            NotificationType.PAYMENT,
            "Payment received",
            f"{plan.currency} {payment.amount_minor:,} received via {payment.provider.value}. Thank you!",
            link="/app/settings/subscription",
        )
        audit(self.db, user.id, "payment.success", payment, demo=payment.is_demo)

    # ---- verification / webhooks / reconciliation -----------------------------

    def verify(self, payment: Payment) -> Payment:
        if payment.status in TERMINAL:
            return payment
        if payment.expires_at < utcnow():
            self._transition(payment, PaymentStatus.EXPIRED, "The approval window expired.")
            self.db.commit()
            return payment
        if not payment.provider_reference:
            return payment
        provider = self.provider_for(payment.provider)
        if provider.is_demo:
            return payment
        try:
            result = provider.verify(payment.provider_reference)
        except PaymentProviderError as exc:
            log.warning("Verification failed for %s: %s", payment.id, exc)
            return payment
        payment.provider_payload = {**payment.provider_payload, "verify": result.payload}
        self._transition(payment, result.status, result.failure_reason)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def handle_webhook(self, provider_name: PaymentProviderName, headers: dict[str, str], body: bytes) -> Payment | None:
        provider = self.provider_for(provider_name)
        event = provider.parse_webhook(headers, body)  # raises on bad signature
        payment = self.db.scalar(select(Payment).where(Payment.provider_reference == event.provider_reference))
        if payment is None:
            log.warning("Webhook for unknown reference %s", event.provider_reference)
            return None
        payment.provider_payload = {**payment.provider_payload, "webhook": event.payload}
        # Webhooks are hints: confirm SUCCESS with the provider before activating anything.
        if event.status == PaymentStatus.SUCCESS and not provider.is_demo:
            try:
                result = provider.verify(payment.provider_reference or "")
                self._transition(payment, result.status, result.failure_reason)
            except PaymentProviderError:
                self._transition(payment, PaymentStatus.PROCESSING)
        else:
            self._transition(payment, event.status, event.failure_reason)
        self.db.commit()
        return payment

    def cancel(self, payment: Payment, user: User) -> Payment:
        if payment.user_id != user.id:
            raise PaymentError("Not found", 404)
        if payment.status in TERMINAL:
            raise PaymentError("This payment has already finished")
        self._transition(payment, PaymentStatus.CANCELLED, "Cancelled by you.")
        self.db.commit()
        return payment

    def demo_confirm(self, payment: Payment, user: User, approve: bool) -> Payment:
        """Demo provider only: explicit test approval/decline. Refused for real providers."""
        if payment.user_id != user.id:
            raise PaymentError("Not found", 404)
        if not payment.is_demo:
            raise PaymentError("Only demo payments can be simulated", 403)
        if payment.status in TERMINAL:
            raise PaymentError("This payment has already finished")
        if approve:
            self._transition(payment, PaymentStatus.SUCCESS)
        else:
            self._transition(payment, PaymentStatus.FAILED, "Declined in demo.")
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def reconcile(self, limit: int = 100) -> int:
        """Background job: re-verify stale non-terminal payments and expire old ones."""
        pending = list(
            self.db.scalars(
                select(Payment).where(Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING])).order_by(Payment.created_at).limit(limit)
            )
        )
        changed = 0
        for p in pending:
            before = p.status
            self.verify(p)
            if p.status != before:
                changed += 1
        return changed

    def list_for_user(self, user_id: uuid.UUID, limit: int = 50) -> list[Payment]:
        return list(self.db.scalars(select(Payment).where(Payment.user_id == user_id).order_by(Payment.created_at.desc()).limit(limit)))
