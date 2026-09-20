from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Enum, Float, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, TZDateTime, UUIDMixin


class DecisionStatus(str, enum.Enum):
    PENDING = "PENDING"
    DECIDED = "DECIDED"
    REVIEWED = "REVIEWED"


class OutcomeRating(str, enum.Enum):
    BETTER = "BETTER"
    EXPECTED = "EXPECTED"
    WORSE = "WORSE"


class Decision(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "decisions"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(280), nullable=False)
    category: Mapped[str | None] = mapped_column(String(32))
    priorities: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    context: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    overrides: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    confidence: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    recommendation: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="demo", nullable=False)
    risk_domain: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[DecisionStatus] = mapped_column(Enum(DecisionStatus, name="decision_status"), default=DecisionStatus.PENDING, nullable=False)
    chosen_scenario_id: Mapped[str | None] = mapped_column(String(64))
    decided_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    outcome_rating: Mapped[OutcomeRating | None] = mapped_column(Enum(OutcomeRating, name="outcome_rating"))
    outcome_note: Mapped[str | None] = mapped_column(Text)
    outcome_recorded_at: Mapped[datetime | None] = mapped_column(TZDateTime())
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    scenarios: Mapped[list[DecisionScenario]] = relationship(back_populates="decision", cascade="all, delete-orphan", order_by="DecisionScenario.position")
    what_ifs: Mapped[list[WhatIfExperiment]] = relationship(back_populates="decision", cascade="all, delete-orphan", order_by="WhatIfExperiment.created_at")


Index("ix_decisions_user_created", Decision.user_id, Decision.created_at.desc())


class DecisionScenario(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "decision_scenarios"

    decision_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    letter: Mapped[str] = mapped_column(String(2), nullable=False)
    title: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    advantages: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    tradeoffs: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    modifiers: Mapped[dict[str, float]] = mapped_column(JSON, default=dict, nullable=False)
    metrics: Mapped[dict[str, int]] = mapped_column(JSON, default=dict, nullable=False)
    timeline: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    projected_balance: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    min_balance: Mapped[float] = mapped_column(Float, default=0, nullable=False)

    decision: Mapped[Decision] = relationship(back_populates="scenarios")


class WhatIfExperiment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "what_if_experiments"

    decision_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(String(280), nullable=False)
    summary: Mapped[str] = mapped_column(String(120), nullable=False)
    overrides: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    result_scores: Mapped[dict[str, int]] = mapped_column(JSON, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="rules", nullable=False)

    decision: Mapped[Decision] = relationship(back_populates="what_ifs")


class DecisionInsight(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "decision_insights"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    headline: Mapped[str] = mapped_column(String(320), nullable=False)
    patterns: Mapped[list[dict[str, object]]] = mapped_column(JSON, default=list, nullable=False)
    stats: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="rules", nullable=False)
    decisions_considered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class DecisionHistory(UUIDMixin, Base):
    """Append-only event log for a decision (created, what-if, decided, outcome, archived)."""

    __tablename__ = "decision_history"

    decision_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), nullable=False)
