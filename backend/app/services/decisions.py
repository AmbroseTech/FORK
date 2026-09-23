"""Decision storage, history, what-if experiments and pattern insights.

Insights are computed only from stored decisions and recorded outcomes; nothing is
inferred about behaviour the user has not actually logged."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.base import utcnow
from app.models import Decision, DecisionHistory, DecisionInsight, DecisionScenario, DecisionStatus, OutcomeRating, User, WhatIfExperiment
from app.schemas.decision import DecisionCreate, DecisionUpdate


class DecisionError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def _history(db: Session, decision_id: uuid.UUID, event: str, **payload: object) -> None:
    db.add(DecisionHistory(decision_id=decision_id, event=event, payload=payload, created_at=utcnow()))


def create_decision(db: Session, user: User, req: DecisionCreate, history_limit: int) -> Decision:
    total = db.scalar(select(func.count()).select_from(Decision).where(Decision.user_id == user.id, Decision.deleted_at.is_(None)))
    if int(total or 0) >= history_limit:
        raise DecisionError(f"Your plan keeps up to {history_limit} saved decisions. Delete or archive one, or upgrade for more.", 402)
    d = Decision(
        user_id=user.id,
        title=req.input.decision.strip(),
        category=req.category,
        priorities=list(req.input.priorities),
        context=req.input.context.model_dump(exclude_none=True),
        overrides=dict(req.overrides),
        confidence=req.confidence.model_dump(),
        recommendation=req.recommendation.model_dump(),
        source=req.source,
        risk_domain=req.riskDomain,
        is_demo=user.is_demo,
    )
    db.add(d)
    db.flush()
    for i, s in enumerate(req.scenarios):
        db.add(
            DecisionScenario(
                decision_id=d.id,
                client_id=s.id,
                position=i,
                letter=s.letter,
                title=s.title,
                description=s.description,
                advantages=s.advantages,
                tradeoffs=s.tradeoffs,
                modifiers=s.modifiers.model_dump(),
                metrics=s.metrics,
                timeline=[t.model_dump() for t in s.timeline],
                score=s.score,
                projected_balance=s.projectedBalance,
                min_balance=s.minBalance,
            )
        )
    _history(db, d.id, "created", source=req.source, scenarios=len(req.scenarios))
    db.commit()
    return get_decision(db, user, d.id)


def get_decision(db: Session, user: User, decision_id: uuid.UUID) -> Decision:
    d = db.scalar(
        select(Decision)
        .options(selectinload(Decision.scenarios), selectinload(Decision.what_ifs))
        .where(Decision.id == decision_id, Decision.user_id == user.id, Decision.deleted_at.is_(None))
    )
    if d is None:
        raise DecisionError("Decision not found", 404)
    return d


def list_decisions(
    db: Session,
    user: User,
    *,
    q: str | None = None,
    status: str | None = None,
    archived: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Decision], int]:
    stmt = select(Decision).where(Decision.user_id == user.id, Decision.deleted_at.is_(None), Decision.is_archived.is_(archived))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Decision.title.ilike(like), Decision.category.ilike(like)))
    if status:
        try:
            stmt = stmt.where(Decision.status == DecisionStatus(status.upper()))
        except ValueError as exc:
            raise DecisionError("Unknown status filter") from exc
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    items = list(
        db.scalars(
            stmt.options(selectinload(Decision.scenarios), selectinload(Decision.what_ifs)).order_by(Decision.created_at.desc()).limit(limit).offset(offset)
        )
    )
    return items, total


def update_decision(db: Session, user: User, decision_id: uuid.UUID, req: DecisionUpdate) -> Decision:
    d = get_decision(db, user, decision_id)
    if req.overrides is not None:
        d.overrides = dict(req.overrides)
    if req.title is not None:
        d.title = req.title.strip()
    if req.isArchived is not None and req.isArchived != d.is_archived:
        d.is_archived = req.isArchived
        _history(db, d.id, "archived" if req.isArchived else "unarchived")
    db.commit()
    return get_decision(db, user, d.id)


def delete_decision(db: Session, user: User, decision_id: uuid.UUID) -> None:
    d = get_decision(db, user, decision_id)
    d.deleted_at = utcnow()
    _history(db, d.id, "deleted")
    db.commit()


def decide(db: Session, user: User, decision_id: uuid.UUID, scenario_id: str) -> Decision:
    d = get_decision(db, user, decision_id)
    if scenario_id not in {s.client_id for s in d.scenarios}:
        raise DecisionError("That scenario does not belong to this decision")
    d.chosen_scenario_id = scenario_id
    d.decided_at = utcnow()
    if d.status == DecisionStatus.PENDING:
        d.status = DecisionStatus.DECIDED
    _history(db, d.id, "decided", scenario_id=scenario_id)
    db.commit()
    return get_decision(db, user, d.id)


def record_outcome(db: Session, user: User, decision_id: uuid.UUID, rating: str, note: str) -> Decision:
    d = get_decision(db, user, decision_id)
    if d.chosen_scenario_id is None:
        raise DecisionError("Choose a scenario before recording how it went")
    d.outcome_rating = OutcomeRating(rating.upper())
    d.outcome_note = note.strip() or None
    d.outcome_recorded_at = utcnow()
    d.status = DecisionStatus.REVIEWED
    _history(db, d.id, "outcome", rating=rating)
    db.commit()
    return get_decision(db, user, d.id)


def add_what_if(
    db: Session,
    user: User,
    decision_id: uuid.UUID,
    prompt: str,
    summary: str,
    overrides: dict[str, float],
    scores: dict[str, int],
    source: str,
) -> WhatIfExperiment:
    d = get_decision(db, user, decision_id)
    w = WhatIfExperiment(decision_id=d.id, prompt=prompt[:280], summary=summary[:120], overrides=overrides, result_scores=scores, source=source)
    db.add(w)
    _history(db, d.id, "what_if", summary=summary[:120])
    db.commit()
    db.refresh(w)
    return w


# ---- insights ---------------------------------------------------------------


@dataclass
class Pattern:
    id: str
    title: str
    detail: str
    tone: str = "neutral"


@dataclass
class PatternReport:
    enough_data: bool
    headline: str
    patterns: list[Pattern]
    stats: dict[str, object]
    decisions_considered: int
    facts: list[str] = field(default_factory=list)


def compute_patterns(decisions: list[Decision]) -> PatternReport:
    decided = [d for d in decisions if d.status != DecisionStatus.PENDING and d.chosen_scenario_id]
    reviewed = [d for d in decisions if d.outcome_rating is not None]
    followed = [d for d in decided if d.chosen_scenario_id == d.recommendation.get("scenarioId")]
    outcomes = {"better": 0, "expected": 0, "worse": 0}
    for d in reviewed:
        assert d.outcome_rating is not None
        outcomes[d.outcome_rating.value.lower()] += 1

    patterns: list[Pattern] = []
    facts: list[str] = []

    if len(decided) >= 2:
        chosen: list[DecisionScenario] = []
        for d in decided:
            s = next((s for s in d.scenarios if s.client_id == d.chosen_scenario_id), None)
            if s:
                chosen.append(s)
        if chosen:

            def avg(key: str) -> float:
                return sum(float(s.metrics.get(key, 0)) for s in chosen) / len(chosen)

            immediacy = sum(1 for s in chosen if float(s.modifiers.get("delayMonths", 0)) == 0) / len(chosen)
            if immediacy >= 0.66:
                patterns.append(
                    Pattern(
                        "immediacy",
                        "You favour acting now",
                        f"{round(immediacy * 100)}% of your chosen paths start immediately. Speed is a strength — check the buffer each time.",
                        "neutral",
                    )
                )
            elif immediacy <= 0.34:
                patterns.append(
                    Pattern(
                        "patience",
                        "You tend to wait",
                        f"{round((1 - immediacy) * 100)}% of your chosen paths include a delay. Ask whether the delay is strategic or avoidance.",
                        "neutral",
                    )
                )
            if avg("opportunity") > avg("risk") + 10:
                patterns.append(
                    Pattern(
                        "upside",
                        "You prioritise upside over safety",
                        f"Chosen paths average opportunity {round(avg('opportunity'))} vs risk control {round(avg('risk'))}.",
                        "caution",
                    )
                )
            elif avg("risk") > avg("opportunity") + 10:
                patterns.append(
                    Pattern(
                        "safety",
                        "You protect stability first",
                        f"Chosen paths average risk control {round(avg('risk'))} vs opportunity {round(avg('opportunity'))}.",
                        "positive",
                    )
                )
        follow_rate = len(followed) / len(decided)
        patterns.append(
            Pattern(
                "follow",
                "You usually align with FORK's take" if follow_rate >= 0.5 else "You often overrule the recommendation",
                f"{len(followed)} of {len(decided)} decisions matched the highest-fit scenario.",
                "neutral",
            )
        )

    if len(reviewed) >= 2:
        if outcomes["worse"] > outcomes["better"]:
            patterns.append(
                Pattern(
                    "underestimate",
                    "You tend to underestimate long-term costs",
                    f'{outcomes["worse"]} of {len(reviewed)} reviewed decisions went worse than expected. Try the "expenses +15%" what-if before deciding.',
                    "caution",
                )
            )
        elif outcomes["better"] > outcomes["worse"]:
            patterns.append(
                Pattern(
                    "conservative",
                    "Your projections run conservative",
                    f"{outcomes['better']} of {len(reviewed)} reviewed decisions went better than expected. You may have room to be bolder.",
                    "positive",
                )
            )

    categories: dict[str, int] = {}
    for d in decisions:
        if d.category:
            categories[d.category] = categories.get(d.category, 0) + 1
    if categories and len(decisions) >= 3:
        top, n = max(categories.items(), key=lambda kv: kv[1])
        if n / len(decisions) >= 0.5:
            patterns.append(
                Pattern(
                    "focus",
                    f"Most of your forks are about {top.lower()}",
                    f"{n} of {len(decisions)} saved decisions are {top} decisions.",
                    "neutral",
                )
            )

    facts = [f"{p.title}: {p.detail}" for p in patterns]
    enough = len(decided) >= 2
    if not decisions:
        headline = "Run your first simulation to start building your decision profile."
    elif not decided:
        headline = "Mark a decision as made to unlock your first pattern."
    elif not patterns:
        headline = "A couple more decisions and your patterns will start to show."
    else:
        headline = patterns[0].detail

    return PatternReport(
        enough_data=enough,
        headline=headline,
        patterns=patterns,
        stats={
            "total": len(decisions),
            "decided": len(decided),
            "reviewed": len(reviewed),
            "followedRecommendation": len(followed),
            "outcomes": outcomes,
        },
        decisions_considered=len(decisions),
        facts=facts,
    )


def store_insight(db: Session, user: User, report: PatternReport, source: str) -> DecisionInsight:
    row = DecisionInsight(
        user_id=user.id,
        headline=report.headline[:320],
        patterns=[p.__dict__ for p in report.patterns],
        stats=report.stats,
        source=source,
        decisions_considered=report.decisions_considered,
    )
    db.add(row)
    db.commit()
    return row
