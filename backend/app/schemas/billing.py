from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str
    price_minor: int
    currency: str
    duration_days: int
    daily_simulations: int
    max_scenarios: int
    ai_depth: str
    custom_what_if: bool
    advanced_insights: bool
    history_limit: int


class UsageOut(BaseModel):
    plan_code: str
    plan_name: str
    status: str
    subscription_ends_at: datetime | None
    trial_remaining: int
    daily_limit: int
    daily_used: int
    remaining_today: int
    resets_at: datetime
    max_scenarios: int
    ai_depth: str
    custom_what_if: bool
    advanced_insights: bool
    history_limit: int
    can_simulate: bool


class PaymentMethodOut(BaseModel):
    id: str
    label: str
    kind: Literal["mobile_money", "card"]
    enabled: bool
    note: str


class InitiatePaymentRequest(BaseModel):
    plan_code: Literal["WEEKLY", "PRO"]
    provider: Literal["MTN", "AIRTEL"]
    phone: str = Field(min_length=9, max_length=16)
    idempotency_key: str = Field(min_length=8, max_length=64)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    status: str
    amount_minor: int
    currency: str
    payer_phone_masked: str
    is_demo: bool
    failure_reason: str | None
    verified_at: datetime | None
    expires_at: datetime
    created_at: datetime


class InitiatePaymentResponse(BaseModel):
    payment: PaymentOut
    instructions: str


class DemoConfirmRequest(BaseModel):
    approve: bool
