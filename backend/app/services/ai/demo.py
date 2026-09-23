"""Deterministic provider. Used when DEMO_MODE=true, when no AI key is configured,
and as the automatic fallback whenever a real provider fails. Never calls the network."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from app.schemas.decision import DecisionInputSchema, ScenarioSeed, ScenarioSummary
from app.services.ai.base import AIProvider, AIRecommendation, DecisionAnalysis, WhatIfInterpretation

DATA = Path(__file__).parent / "data" / "templates.json"


class Template:
    def __init__(self, raw: dict[str, object]) -> None:
        match = raw.get("match")
        self.match = re.compile(str(match), re.IGNORECASE) if isinstance(match, str) else None
        self.category = str(raw["category"])
        variables = raw.get("variables", [])
        self.variables = [str(v) for v in variables] if isinstance(variables, list) else []
        scenarios = raw.get("scenarios", [])
        self.scenarios = [ScenarioSeed.model_validate(s) for s in scenarios] if isinstance(scenarios, list) else []


@lru_cache
def load_templates() -> tuple[list[Template], Template]:
    raw = json.loads(DATA.read_text(encoding="utf-8"))
    return [Template(t) for t in raw["templates"]], Template(raw["generic"])


def pick_template(decision: str) -> Template:
    templates, generic = load_templates()
    for t in templates:
        if t.match and t.match.search(decision):
            return t
    return generic


_WHAT_IF_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(income|earn|salary|pay)", re.I), "monthlyIncome"),
    (re.compile(r"(expense|spend|rent|cost of living)", re.I), "monthlyExpenses"),
    (re.compile(r"(saving|buffer)", re.I), "savings"),
    (re.compile(r"(price|cost|cheaper|expensive)", re.I), "cost"),
    (re.compile(r"(month|horizon|year)", re.I), "horizonMonths"),
]


class DemoProvider(AIProvider):
    source = "demo"

    def analyze_decision(self, input_: DecisionInputSchema) -> DecisionAnalysis:
        t = pick_template(input_.decision)
        return DecisionAnalysis(
            category=t.category,
            variables=t.variables[:8],
            suggested_questions=[f"What is your {v}?" for v in t.variables[:3]],
        )

    def generate_scenarios(self, input_: DecisionInputSchema, count: int) -> list[ScenarioSeed]:
        t = pick_template(input_.decision)
        return t.scenarios[: max(2, min(count, len(t.scenarios)))]

    def explain_tradeoffs(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary]) -> str:
        if not scenarios:
            return "No scenarios to compare yet."
        best = max(scenarios, key=lambda s: s.score)
        safest = max(scenarios, key=lambda s: s.minBalance)
        parts = [f"Option {best.letter} ({best.title}) scores highest against your priorities ({best.score}/100)."]
        if safest.id != best.id:
            parts.append(f"Option {safest.letter} ({safest.title}) keeps the healthiest cash buffer, so it is the more cautious path if surprises worry you.")
        parts.append("These are seeded, rule-based comparisons — FORK explores possible outcomes, it does not predict the future.")
        return " ".join(parts)

    def generate_recommendation(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary], fallback: AIRecommendation) -> AIRecommendation:
        return fallback

    def interpret_what_if(self, text: str, context: dict[str, object]) -> WhatIfInterpretation | None:
        m = re.search(r"(-?\d[\d,\.]*)\s*(%|percent|k|m)?", text, re.I)
        if not m:
            return None
        number = float(m.group(1).replace(",", ""))
        unit = (m.group(2) or "").lower()
        variable = next((v for pat, v in _WHAT_IF_PATTERNS if pat.search(text)), None)
        if variable is None:
            return None
        current = context.get(variable)
        if unit in ("%", "percent"):
            if not isinstance(current, (int, float)):
                return None
            sign = -1 if re.search(r"(drop|fall|less|lower|cut|decreas)", text, re.I) else 1
            value = float(current) * (1 + sign * number / 100)
        else:
            value = number * (1000 if unit == "k" else 1_000_000 if unit == "m" else 1)
        if variable == "horizonMonths":
            value = max(1, min(60, round(value)))
        return WhatIfInterpretation(summary=f"{variable} → {value:,.0f}", overrides={variable: value})

    def generate_insight(self, patterns: list[str], outcomes: dict[str, int]) -> str | None:
        return None
