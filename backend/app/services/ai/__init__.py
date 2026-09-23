"""Provider selection with automatic deterministic fallback.

Default: Gemini free tier (GEMINI_API_KEY). Groq and OpenAI-compatible endpoints are
optional. If DEMO_MODE=true, the selected provider has no key, or any call fails, the
deterministic DemoProvider answers instead so the app always works."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Callable
from functools import lru_cache

from app.core.cache import get_cache
from app.core.config import Settings, get_settings
from app.schemas.decision import DecisionInputSchema, ScenarioSeed, ScenarioSummary
from app.services.ai.base import AIProvider, AIProviderError, AIRecommendation, DecisionAnalysis, WhatIfInterpretation
from app.services.ai.demo import DemoProvider
from app.services.ai.llm import GeminiProvider, OpenAICompatibleProvider

log = logging.getLogger(__name__)

__all__ = [
    "AIProvider",
    "AIProviderError",
    "AIRecommendation",
    "DecisionAnalysis",
    "DemoProvider",
    "ResilientAI",
    "WhatIfInterpretation",
    "build_provider",
    "get_ai",
]


def build_provider(settings: Settings) -> AIProvider:
    if settings.demo_mode:
        return DemoProvider()
    name = settings.ai_provider
    if name == "gemini" and settings.gemini_api_key:
        return GeminiProvider(settings)
    if name == "groq" and settings.groq_api_key:
        return OpenAICompatibleProvider(settings, "groq", settings.groq_api_key, settings.groq_model, settings.groq_base_url)
    if name == "openai" and settings.openai_api_key:
        return OpenAICompatibleProvider(settings, "openai", settings.openai_api_key, settings.openai_model, settings.openai_base_url)
    if name != "demo":
        log.warning("AI_PROVIDER=%s selected but no API key configured; using deterministic demo provider", name)
    return DemoProvider()


class ResilientAI:
    """Wraps a real provider and falls back to DemoProvider per call, caching successful results."""

    def __init__(self, primary: AIProvider, settings: Settings) -> None:
        self.primary = primary
        self.fallback = DemoProvider()
        self.settings = settings
        self.last_error: str | None = None

    @property
    def configured_source(self) -> str:
        return self.primary.source

    def _cached[T](self, key_parts: object, fn: Callable[[], T], encode: Callable[[T], str], decode: Callable[[str], T]) -> T:
        cache = get_cache()
        key = "ai:" + hashlib.sha256(json.dumps(key_parts, sort_keys=True, default=str).encode()).hexdigest()
        hit = cache.get(key)
        if hit is not None:
            try:
                return decode(hit)
            except Exception:  # noqa: BLE001 - corrupt cache entry; recompute
                cache.delete(key)
        value = fn()
        cache.set(key, encode(value), ex=self.settings.ai_cache_seconds)
        return value

    def _run[T](self, name: str, primary: Callable[[], T], fallback: Callable[[], T]) -> tuple[T, str]:
        if isinstance(self.primary, DemoProvider):
            return fallback(), "demo"
        try:
            result = primary()
            self.last_error = None
            return result, self.primary.source
        except AIProviderError as exc:
            self.last_error = f"{exc.code}: {exc}"
            log.warning("AI %s via %s failed (%s); using deterministic fallback", name, self.primary.source, exc.code)
            return fallback(), "demo"

    def analyze(self, input_: DecisionInputSchema) -> tuple[DecisionAnalysis, str]:
        return self._run("analyze", lambda: self.primary.analyze_decision(input_), lambda: self.fallback.analyze_decision(input_))

    def scenarios(self, input_: DecisionInputSchema, count: int) -> tuple[list[ScenarioSeed], str]:
        def primary() -> list[ScenarioSeed]:
            return self._cached(
                ["scenarios", self.primary.source, input_.model_dump(), count],
                lambda: self.primary.generate_scenarios(input_, count),
                lambda v: json.dumps([s.model_dump() for s in v]),
                lambda s: [ScenarioSeed.model_validate(x) for x in json.loads(s)],
            )

        return self._run("scenarios", primary, lambda: self.fallback.generate_scenarios(input_, count))

    def tradeoffs(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary]) -> tuple[str, str]:
        return self._run(
            "tradeoffs",
            lambda: self.primary.explain_tradeoffs(input_, scenarios),
            lambda: self.fallback.explain_tradeoffs(input_, scenarios),
        )

    def recommendation(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary], fallback: AIRecommendation) -> tuple[AIRecommendation, str]:
        return self._run(
            "recommendation",
            lambda: self.primary.generate_recommendation(input_, scenarios, fallback),
            lambda: fallback,
        )

    def what_if(self, text: str, context: dict[str, object]) -> tuple[WhatIfInterpretation | None, str]:
        return self._run(
            "what_if",
            lambda: self.primary.interpret_what_if(text, context),
            lambda: self.fallback.interpret_what_if(text, context),
        )

    def insight(self, patterns: list[str], outcomes: dict[str, int]) -> tuple[str | None, str]:
        return self._run("insight", lambda: self.primary.generate_insight(patterns, outcomes), lambda: None)


@lru_cache
def get_ai() -> ResilientAI:
    settings = get_settings()
    return ResilientAI(build_provider(settings), settings)
