from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["money", "career", "education", "convenience", "business", "relationships", "lifestyle"]
Currency = Literal["UGX", "USD", "KES", "NGN", "EUR", "GBP", "INR"]


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DecisionContext(Camel):
    currency: Currency = "UGX"
    savings: float | None = None
    monthlyIncome: float | None = None
    monthlyExpenses: float | None = None
    cost: float | None = None
    goal: str | None = Field(default=None, max_length=120)
    goalAmount: float | None = None
    horizonMonths: int = Field(default=6, ge=1, le=60)


class DecisionInputSchema(Camel):
    decision: str = Field(min_length=8, max_length=280)
    priorities: list[Priority] = Field(min_length=1, max_length=3)
    context: DecisionContext


class ScenarioModifiers(Camel):
    costMultiplier: float = Field(default=1, ge=0, le=5)
    delayMonths: float = Field(default=0, ge=0, le=36)
    incomeMultiplier: float = Field(default=1, ge=0, le=5)
    expenseMultiplier: float = Field(default=1, ge=0, le=5)
    benefitFactor: float = Field(default=0.5, ge=0, le=1)
    reversibility: float = Field(default=0.5, ge=0, le=1)
    extraMonthlyIncome: float = Field(default=0, ge=0)
    extraIncomeStartMonth: float = Field(default=0, ge=0)


class ScenarioSeed(Camel):
    title: str = Field(min_length=2, max_length=40)
    description: str = Field(min_length=10, max_length=280)
    advantages: list[str] = Field(min_length=1, max_length=5)
    tradeoffs: list[str] = Field(min_length=1, max_length=5)
    modifiers: ScenarioModifiers = Field(default_factory=ScenarioModifiers)


class ScenarioSeedList(Camel):
    scenarios: list[ScenarioSeed] = Field(min_length=2, max_length=4)


class ScenarioSummary(Camel):
    """What the client computed deterministically; the AI only sees this to explain, never to compute."""

    id: str
    letter: str
    title: str
    score: int
    metrics: dict[str, float]
    projectedBalance: float
    minBalance: float


class TimelineEvent(Camel):
    id: str
    label: str
    title: str
    detail: str | None = None
    balance: float | None = None
    tone: Literal["neutral", "positive", "negative", "milestone"] = "neutral"


class ScenarioFull(ScenarioSeed):
    id: str
    letter: str
    score: int
    metrics: dict[str, float]
    timeline: list[TimelineEvent]
    projectedBalance: float
    minBalance: float


class Recommendation(Camel):
    scenarioId: str
    take: str
    why: list[str]


class Confidence(Camel):
    level: Literal["LOW", "MEDIUM", "HIGH"]
    present: list[str]
    missing: list[str]


# ---- API payloads -------------------------------------------------------------


class SeedRequest(DecisionInputSchema):
    pass


class SeedResponse(Camel):
    category: str
    scenarios: list[ScenarioSeed]
    source: str
    ai_note: str | None = None


class RecommendRequest(Camel):
    input: DecisionInputSchema
    scenarios: list[ScenarioSummary]
    fallback: Recommendation


class RecommendResponse(Camel):
    recommendation: Recommendation
    tradeoffs: str | None = None
    source: str


class DecisionCreate(Camel):
    input: DecisionInputSchema
    overrides: dict[str, float] = Field(default_factory=dict)
    scenarios: list[ScenarioFull] = Field(min_length=2, max_length=4)
    recommendation: Recommendation
    confidence: Confidence
    source: str = "demo"
    riskDomain: Literal["medical", "legal", "financial"] | None = None
    category: str | None = None


class DecisionUpdate(Camel):
    overrides: dict[str, float] | None = None
    isArchived: bool | None = None
    title: str | None = Field(default=None, min_length=8, max_length=280)


class DecideRequest(Camel):
    scenarioId: str


class OutcomeRequest(Camel):
    rating: Literal["better", "expected", "worse"]
    note: str = Field(default="", max_length=600)


class WhatIfRequest(Camel):
    prompt: str = Field(min_length=2, max_length=280)
    context: DecisionContext
    resultScores: dict[str, int] = Field(default_factory=dict)
    ruleSummary: str | None = None
    ruleOverrides: dict[str, float] | None = None


class WhatIfResponse(Camel):
    id: uuid.UUID | None = None
    summary: str
    overrides: dict[str, float]
    source: str


class WhatIfOut(Camel):
    id: uuid.UUID
    prompt: str
    summary: str
    overrides: dict[str, object]
    resultScores: dict[str, int] = Field(validation_alias="result_scores")
    source: str
    createdAt: datetime = Field(validation_alias="created_at")


class DecisionOut(Camel):
    id: uuid.UUID
    title: str
    category: str | None
    priorities: list[str]
    context: dict[str, object]
    overrides: dict[str, object]
    confidence: dict[str, object]
    recommendation: dict[str, object]
    source: str
    riskDomain: str | None = Field(validation_alias="risk_domain")
    status: str
    chosenScenarioId: str | None = Field(validation_alias="chosen_scenario_id")
    decidedAt: datetime | None = Field(validation_alias="decided_at")
    outcomeRating: str | None = Field(validation_alias="outcome_rating")
    outcomeNote: str | None = Field(validation_alias="outcome_note")
    outcomeRecordedAt: datetime | None = Field(validation_alias="outcome_recorded_at")
    isArchived: bool = Field(validation_alias="is_archived")
    createdAt: datetime = Field(validation_alias="created_at")
    updatedAt: datetime = Field(validation_alias="updated_at")
    scenarios: list[ScenarioOut] = Field(default_factory=list)
    whatIfs: list[WhatIfOut] = Field(default_factory=list, validation_alias="what_ifs")


class ScenarioOut(Camel):
    id: str = Field(validation_alias="client_id")
    letter: str
    title: str
    description: str
    advantages: list[str]
    tradeoffs: list[str]
    modifiers: dict[str, float]
    metrics: dict[str, float]
    timeline: list[dict[str, object]]
    score: int
    projectedBalance: float = Field(validation_alias="projected_balance")
    minBalance: float = Field(validation_alias="min_balance")


class DecisionListOut(Camel):
    items: list[DecisionOut]
    total: int


class PatternOut(Camel):
    id: str
    title: str
    detail: str
    tone: Literal["positive", "neutral", "caution"]


class InsightsOut(Camel):
    enough_data: bool
    decisions_considered: int
    patterns: list[PatternOut]
    stats: dict[str, object]
    headline: str
    ai_note: str | None = None
    source: str


DecisionOut.model_rebuild()
