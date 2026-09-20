from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.core.deps import DB, CacheDep, CurrentUser, rate_limit
from app.schemas.decision import (
    DecideRequest,
    DecisionCreate,
    DecisionListOut,
    DecisionOut,
    DecisionUpdate,
    InsightsOut,
    OutcomeRequest,
    PatternOut,
    Recommendation,
    RecommendRequest,
    RecommendResponse,
    SeedRequest,
    SeedResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from app.services import decisions as svc
from app.services.ai import get_ai
from app.services.ai.base import AIRecommendation
from app.services.decisions import DecisionError
from app.services.subscriptions import UsageLimitReached, consume_simulation, snapshot

router = APIRouter(prefix="/api", tags=["decisions"])


def _usage_payload(exc: UsageLimitReached) -> JSONResponse:
    s = exc.snapshot
    return JSONResponse(
        status_code=402,
        content={
            "detail": "usage_limit_reached",
            "message": "You've used today's free simulations. Come back tomorrow or unlock weekly access for UGX 3,000.",
            "usage": {
                "trial_remaining": s.trial_remaining,
                "daily_limit": s.daily_limit,
                "daily_used": s.daily_used,
                "resets_at": s.resets_at.isoformat(),
            },
        },
    )


def _wrap(exc: DecisionError) -> HTTPException:
    return HTTPException(exc.status_code, str(exc))


@router.post("/simulate/seed", response_model=SeedResponse, dependencies=[rate_limit("simulate", 20)])
def seed(req: SeedRequest, db: DB, cache: CacheDep, user: CurrentUser) -> SeedResponse | JSONResponse:
    """Consume one simulation and return scenario seeds. Arithmetic happens on the client engine."""
    try:
        snap = consume_simulation(db, user, cache)
    except UsageLimitReached as exc:
        return _usage_payload(exc)
    ai = get_ai()
    analysis, _ = ai.analyze(req)
    scenarios, source = ai.scenarios(req, snap.max_scenarios)
    note = None
    if source == "demo" and ai.configured_source != "demo":
        note = "Live AI was unavailable, so FORK used its deterministic engine for this run."
    return SeedResponse(category=analysis.category, scenarios=scenarios, source=source, ai_note=note)


@router.post("/simulate/recommend", response_model=RecommendResponse, dependencies=[rate_limit("simulate", 40)])
def recommend(req: RecommendRequest, user: CurrentUser) -> RecommendResponse:
    ai = get_ai()
    fallback = AIRecommendation(scenario_id=req.fallback.scenarioId, take=req.fallback.take, why=req.fallback.why)
    rec, source = ai.recommendation(req.input, req.scenarios, fallback)
    tradeoffs, _ = ai.tradeoffs(req.input, req.scenarios)
    return RecommendResponse(
        recommendation=Recommendation(scenarioId=rec.scenario_id, take=rec.take, why=rec.why),
        tradeoffs=tradeoffs or None,
        source=source,
    )


@router.get("/decisions", response_model=DecisionListOut)
def list_decisions(
    db: DB,
    user: CurrentUser,
    q: str | None = None,
    status: str | None = None,
    archived: bool = False,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> DecisionListOut:
    try:
        items, total = svc.list_decisions(db, user, q=q, status=status, archived=archived, limit=limit, offset=offset)
    except DecisionError as exc:
        raise _wrap(exc) from exc
    return DecisionListOut(items=[DecisionOut.model_validate(d) for d in items], total=total)


@router.post("/decisions", response_model=DecisionOut, status_code=201)
def create_decision(req: DecisionCreate, db: DB, cache: CacheDep, user: CurrentUser) -> DecisionOut:
    snap = snapshot(db, user, cache)
    try:
        return DecisionOut.model_validate(svc.create_decision(db, user, req, snap.history_limit))
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.get("/decisions/{decision_id}", response_model=DecisionOut)
def get_decision(decision_id: uuid.UUID, db: DB, user: CurrentUser) -> DecisionOut:
    try:
        return DecisionOut.model_validate(svc.get_decision(db, user, decision_id))
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.patch("/decisions/{decision_id}", response_model=DecisionOut)
def update_decision(decision_id: uuid.UUID, req: DecisionUpdate, db: DB, user: CurrentUser) -> DecisionOut:
    try:
        return DecisionOut.model_validate(svc.update_decision(db, user, decision_id, req))
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.delete("/decisions/{decision_id}", status_code=204)
def delete_decision(decision_id: uuid.UUID, db: DB, user: CurrentUser) -> None:
    try:
        svc.delete_decision(db, user, decision_id)
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.post("/decisions/{decision_id}/decide", response_model=DecisionOut)
def decide(decision_id: uuid.UUID, req: DecideRequest, db: DB, user: CurrentUser) -> DecisionOut:
    try:
        return DecisionOut.model_validate(svc.decide(db, user, decision_id, req.scenarioId))
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.post("/decisions/{decision_id}/outcome", response_model=DecisionOut)
def outcome(decision_id: uuid.UUID, req: OutcomeRequest, db: DB, user: CurrentUser) -> DecisionOut:
    try:
        return DecisionOut.model_validate(svc.record_outcome(db, user, decision_id, req.rating, req.note))
    except DecisionError as exc:
        raise _wrap(exc) from exc


@router.post("/what-if/interpret", response_model=WhatIfResponse, dependencies=[rate_limit("whatif", 60)])
def interpret_what_if(req: WhatIfRequest, db: DB, cache: CacheDep, user: CurrentUser) -> WhatIfResponse:
    """Turn free text into deterministic overrides. Rule-based parse from the client wins when present."""
    snap = snapshot(db, user, cache)
    if req.ruleOverrides:
        return WhatIfResponse(summary=req.ruleSummary or req.prompt, overrides=req.ruleOverrides, source="rules")
    if not snap.custom_what_if:
        raise HTTPException(402, "Custom what-if questions need Weekly or Pro access. Try the quick experiments instead.")
    interp, source = get_ai().what_if(req.prompt, req.context.model_dump(exclude_none=True))
    if interp is None:
        raise HTTPException(422, "FORK couldn't turn that into a numeric experiment. Try e.g. 'expenses +15%' or 'wait 3 months'.")
    return WhatIfResponse(summary=interp.summary, overrides=interp.overrides, source=source)


@router.post("/decisions/{decision_id}/what-if", response_model=WhatIfResponse, status_code=201)
def save_what_if(decision_id: uuid.UUID, req: WhatIfRequest, db: DB, user: CurrentUser) -> WhatIfResponse:
    if not req.ruleOverrides:
        raise HTTPException(400, "Interpret the experiment first, then save it with its overrides")
    try:
        w = svc.add_what_if(db, user, decision_id, req.prompt, req.ruleSummary or req.prompt, req.ruleOverrides, req.resultScores, "rules")
    except DecisionError as exc:
        raise _wrap(exc) from exc
    return WhatIfResponse(id=w.id, summary=w.summary, overrides={k: float(v) for k, v in w.overrides.items() if isinstance(v, int | float)}, source=w.source)


@router.get("/insights", response_model=InsightsOut)
def insights(db: DB, cache: CacheDep, user: CurrentUser) -> InsightsOut:
    items, _ = svc.list_decisions(db, user, limit=200)
    report = svc.compute_patterns(items)
    snap = snapshot(db, user, cache)
    ai_note = None
    source = "rules"
    if report.enough_data and snap.advanced_insights and report.facts:
        note, source = get_ai().insight(report.facts, report.stats["outcomes"])  # type: ignore[arg-type]
        ai_note = note
    if report.enough_data:
        svc.store_insight(db, user, report, source)
    return InsightsOut(
        enough_data=report.enough_data,
        decisions_considered=report.decisions_considered,
        patterns=[PatternOut(id=p.id, title=p.title, detail=p.detail, tone=p.tone) for p in report.patterns],  # type: ignore[arg-type]
        stats=report.stats,
        headline=report.headline,
        ai_note=ai_note,
        source=source,
    )
