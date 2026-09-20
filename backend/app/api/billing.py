from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from app.core.deps import DB, CacheDep, CurrentUser, SettingsDep, rate_limit
from app.models import Payment, PaymentProviderName, PlanCode
from app.schemas.billing import (
    DemoConfirmRequest,
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    PaymentMethodOut,
    PaymentOut,
    PlanOut,
    UsageOut,
)
from app.services.payments import PaymentError, PaymentProviderError, PaymentService
from app.services.subscriptions import UsageSnapshot, list_plans, snapshot

router = APIRouter(prefix="/api", tags=["billing"])


def _usage_out(snap: UsageSnapshot) -> UsageOut:
    return UsageOut(
        plan_code=snap.plan_code.value,
        plan_name=snap.plan_name,
        status=snap.status.value,
        subscription_ends_at=snap.subscription_ends_at,
        trial_remaining=snap.trial_remaining,
        daily_limit=snap.daily_limit,
        daily_used=snap.daily_used,
        remaining_today=snap.remaining_today,
        resets_at=snap.resets_at,
        max_scenarios=snap.max_scenarios,
        ai_depth=snap.ai_depth,
        custom_what_if=snap.custom_what_if,
        advanced_insights=snap.advanced_insights,
        history_limit=snap.history_limit,
        can_simulate=snap.can_simulate,
    )


@router.get("/plans", response_model=list[PlanOut])
def plans(db: DB) -> list[PlanOut]:
    return [PlanOut.model_validate(p) for p in list_plans(db)]


@router.get("/usage", response_model=UsageOut)
def usage(db: DB, cache: CacheDep, user: CurrentUser) -> UsageOut:
    return _usage_out(snapshot(db, user, cache))


@router.get("/payments/methods", response_model=list[PaymentMethodOut])
def payment_methods(settings: SettingsDep) -> list[PaymentMethodOut]:
    demo = " (demo — no real money moves)" if settings.payments_demo else ""
    return [
        PaymentMethodOut(id="MTN", label="MTN Mobile Money", kind="mobile_money", enabled=True, note="Approve the prompt on your phone" + demo),
        PaymentMethodOut(id="AIRTEL", label="Airtel Money", kind="mobile_money", enabled=True, note="Approve the prompt on your phone" + demo),
        PaymentMethodOut(id="VISA", label="Visa", kind="card", enabled=False, note="Coming soon"),
        PaymentMethodOut(id="MASTERCARD", label="Mastercard", kind="card", enabled=False, note="Coming soon"),
    ]


def _payment_for(db: DB, user: CurrentUser, payment_id: uuid.UUID) -> Payment:
    p = db.scalar(select(Payment).where(Payment.id == payment_id, Payment.user_id == user.id))
    if p is None:
        raise HTTPException(404, "Payment not found")
    return p


@router.post("/payments/initiate", response_model=InitiatePaymentResponse, status_code=201, dependencies=[rate_limit("payments", 10)])
def initiate(req: InitiatePaymentRequest, db: DB, user: CurrentUser, settings: SettingsDep) -> InitiatePaymentResponse:
    try:
        payment, instructions = PaymentService(db, settings).initiate(
            user, PlanCode(req.plan_code), PaymentProviderName(req.provider), req.phone, req.idempotency_key
        )
    except PaymentError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return InitiatePaymentResponse(payment=PaymentOut.model_validate(payment), instructions=instructions)


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(db: DB, user: CurrentUser, settings: SettingsDep) -> list[PaymentOut]:
    return [PaymentOut.model_validate(p) for p in PaymentService(db, settings).list_for_user(user.id)]


@router.get("/payments/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: uuid.UUID, db: DB, user: CurrentUser) -> PaymentOut:
    return PaymentOut.model_validate(_payment_for(db, user, payment_id))


@router.post("/payments/{payment_id}/verify", response_model=PaymentOut, dependencies=[rate_limit("payments", 30)])
def verify(payment_id: uuid.UUID, db: DB, user: CurrentUser, settings: SettingsDep) -> PaymentOut:
    p = _payment_for(db, user, payment_id)
    try:
        return PaymentOut.model_validate(PaymentService(db, settings).verify(p))
    except PaymentError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.post("/payments/{payment_id}/cancel", response_model=PaymentOut)
def cancel(payment_id: uuid.UUID, db: DB, user: CurrentUser, settings: SettingsDep) -> PaymentOut:
    p = _payment_for(db, user, payment_id)
    try:
        return PaymentOut.model_validate(PaymentService(db, settings).cancel(p, user))
    except PaymentError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.post("/payments/{payment_id}/demo-confirm", response_model=PaymentOut)
def demo_confirm(payment_id: uuid.UUID, req: DemoConfirmRequest, db: DB, user: CurrentUser, settings: SettingsDep) -> PaymentOut:
    """Demo provider only: explicitly simulate the payer approving or declining on their handset."""
    if not settings.payments_demo:
        raise HTTPException(404, "Not found")
    p = _payment_for(db, user, payment_id)
    try:
        return PaymentOut.model_validate(PaymentService(db, settings).demo_confirm(p, user, req.approve))
    except PaymentError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


@router.post("/payments/webhooks/{provider}", status_code=202)
async def webhook(provider: str, request: Request, db: DB, settings: SettingsDep) -> dict[str, str]:
    try:
        name = PaymentProviderName(provider.upper())
    except ValueError as exc:
        raise HTTPException(404, "Unknown provider") from exc
    body = await request.body()
    try:
        PaymentService(db, settings).handle_webhook(name, dict(request.headers), body)
    except PaymentProviderError as exc:
        raise HTTPException(401 if exc.code == "bad_signature" else 400, str(exc)) from exc
    except PaymentError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return {"status": "accepted"}
