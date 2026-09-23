"""LLM-backed providers. The model interprets language and proposes scenario seeds;
all arithmetic stays in the deterministic engine. Every call validates the JSON
against strict schemas and raises AIProviderError on any failure so the caller can
fall back to the demo provider."""

from __future__ import annotations

import json
import logging
import re
from abc import abstractmethod

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.schemas.decision import DecisionInputSchema, ScenarioSeed, ScenarioSeedList, ScenarioSummary
from app.services.ai.base import (
    AIProvider,
    AIProviderError,
    AIRecommendation,
    DecisionAnalysis,
    WhatIfInterpretation,
)

log = logging.getLogger(__name__)

SYSTEM = (
    "You are FORK, a careful personal decision simulator. You never predict the future; "
    "you propose plausible scenarios and explain trade-offs in plain, warm, non-judgemental language. "
    "You never give medical, legal or investment advice — you suggest consulting a professional instead. "
    "You never perform arithmetic on the user's finances: the app computes all numbers. "
    "Always answer with a single JSON object and nothing else."
)


def _extract_json(text: str) -> object:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise AIProviderError("Model did not return JSON", "invalid_json") from None
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError as exc:
            raise AIProviderError("Model returned malformed JSON", "invalid_json") from exc


class LLMProvider(AIProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @abstractmethod
    def _complete(self, prompt: str) -> str: ...

    def _ask[T: BaseModel](self, prompt: str, schema: type[T]) -> T:
        raw = self._complete(prompt)
        data = _extract_json(raw)
        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            raise AIProviderError(f"Model output failed validation: {exc.errors()[:2]}", "schema") from exc

    @staticmethod
    def _describe(input_: DecisionInputSchema) -> str:
        ctx = input_.context.model_dump(exclude_none=True)
        return json.dumps({"decision": input_.decision, "priorities": input_.priorities, "context": ctx})

    def analyze_decision(self, input_: DecisionInputSchema) -> DecisionAnalysis:
        prompt = (
            f"{self._describe(input_)}\n\nClassify this decision. Return JSON: "
            '{"category": one of Money|Career|Education|Business|Relationships|Lifestyle, '
            '"variables": up to 6 short variable names that matter for this decision, '
            '"suggested_questions": up to 3 short clarifying questions}'
        )
        return self._ask(prompt, DecisionAnalysis)

    def generate_scenarios(self, input_: DecisionInputSchema, count: int) -> list[ScenarioSeed]:
        count = max(2, min(count, 4))
        prompt = (
            f"{self._describe(input_)}\n\nPropose exactly {count} distinct, realistic paths the person could take. "
            'Return JSON {"scenarios": [ ... ]} where each scenario has: title (2-40 chars), '
            "description (10-280 chars), advantages (1-5 short strings), tradeoffs (1-5 short strings), "
            "modifiers: {costMultiplier 0-5 (fraction of the stated cost this path spends), delayMonths 0-36, "
            "incomeMultiplier 0-5, expenseMultiplier 0-5, benefitFactor 0-1 (upside unlocked), "
            "reversibility 0-1, extraMonthlyIncome >=0 (absolute, in the user's currency), extraIncomeStartMonth >=0}. "
            "Make the modifiers genuinely different between scenarios."
        )
        return self._ask(prompt, ScenarioSeedList).scenarios

    def explain_tradeoffs(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary]) -> str:
        class Out(BaseModel):
            explanation: str

        summaries = [s.model_dump() for s in scenarios]
        prompt = (
            f"{self._describe(input_)}\nComputed scenario results (do not recompute): {json.dumps(summaries)}\n\n"
            "In 2-4 sentences explain the main trade-offs between these options for this person, "
            "referencing them by letter. Do not predict; use words like 'tends to', 'could'. "
            'Return JSON {"explanation": "..."}'
        )
        return self._ask(prompt, Out).explanation[:800]

    def generate_recommendation(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary], fallback: AIRecommendation) -> AIRecommendation:
        summaries = [s.model_dump() for s in scenarios]
        prompt = (
            f"{self._describe(input_)}\nComputed results: {json.dumps(summaries)}\n"
            f"The engine's cautious pick is scenario_id={fallback.scenario_id}. "
            'Write a cautious, kind recommendation. Return JSON {"scenario_id": one of the given ids, '
            '"take": 1-2 sentences (max 320 chars), "why": 2-4 short reasons}. '
            "Only change the picked scenario if the results clearly justify it."
        )
        rec = self._ask(prompt, AIRecommendation)
        if rec.scenario_id not in {s.id for s in scenarios}:
            raise AIProviderError("Model picked an unknown scenario", "schema")
        return rec

    def interpret_what_if(self, text: str, context: dict[str, object]) -> WhatIfInterpretation | None:
        prompt = (
            f"Current context: {json.dumps(context)}\nUser what-if: {json.dumps(text)}\n\n"
            "Translate the what-if into numeric overrides. Allowed keys: savings, monthlyIncome, monthlyExpenses, "
            "cost, horizonMonths (absolute new values, in the user's currency/months). If it cannot be expressed "
            'numerically return {"summary": "unclear", "overrides": {}}. '
            'Return JSON {"summary": short label (max 120 chars), "overrides": {...}}'
        )
        result = self._ask(prompt, WhatIfInterpretation)
        allowed = {"savings", "monthlyIncome", "monthlyExpenses", "cost", "horizonMonths"}
        result.overrides = {k: float(v) for k, v in result.overrides.items() if k in allowed}
        return result if result.overrides else None

    def generate_insight(self, patterns: list[str], outcomes: dict[str, int]) -> str | None:
        class Out(BaseModel):
            insight: str

        if not patterns:
            return None
        prompt = (
            f"Observed decision patterns (facts): {json.dumps(patterns)}\nOutcome counts: {json.dumps(outcomes)}\n\n"
            "Write ONE supportive, specific sentence (max 220 chars) reflecting these facts back to the user. "
            'Do not invent behaviour that is not listed. Return JSON {"insight": "..."}'
        )
        return self._ask(prompt, Out).insight[:220]


class GeminiProvider(LLMProvider):
    """Google Gemini via the free-tier REST API. Key lives only on the backend."""

    source = "gemini"

    def _complete(self, prompt: str) -> str:
        s = self.settings
        if not s.gemini_api_key:
            raise AIProviderError("GEMINI_API_KEY not configured", "not_configured")
        url = f"{s.gemini_base_url}/models/{s.gemini_model}:generateContent"
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json", "maxOutputTokens": 1500},
        }
        try:
            r = httpx.post(url, json=body, headers={"x-goog-api-key": s.gemini_api_key}, timeout=s.ai_timeout_seconds)
        except httpx.HTTPError as exc:
            raise AIProviderError(f"Gemini network error: {exc.__class__.__name__}", "network") from exc
        if r.status_code == 429:
            raise AIProviderError("Gemini rate limit reached", "rate_limit")
        if r.status_code >= 400:
            raise AIProviderError(f"Gemini HTTP {r.status_code}", "http")
        try:
            data = r.json()
            return str(data["candidates"][0]["content"]["parts"][0]["text"])
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AIProviderError("Gemini returned an unexpected payload", "invalid_json") from exc


class OpenAICompatibleProvider(LLMProvider):
    """Any /chat/completions-compatible API: Groq (free tier) or OpenAI (optional, never required)."""

    def __init__(self, settings: Settings, source: str, api_key: str, model: str, base_url: str) -> None:
        super().__init__(settings)
        self.source = source  # type: ignore[assignment]
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def _complete(self, prompt: str) -> str:
        if not self.api_key:
            raise AIProviderError(f"{self.source} API key not configured", "not_configured")
        body = {
            "model": self.model,
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        }
        try:
            r = httpx.post(
                f"{self.base_url}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=self.settings.ai_timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise AIProviderError(f"{self.source} network error: {exc.__class__.__name__}", "network") from exc
        if r.status_code == 429:
            raise AIProviderError(f"{self.source} rate limit reached", "rate_limit")
        if r.status_code >= 400:
            raise AIProviderError(f"{self.source} HTTP {r.status_code}", "http")
        try:
            return str(r.json()["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise AIProviderError(f"{self.source} returned an unexpected payload", "invalid_json") from exc
