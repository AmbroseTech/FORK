from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.decision import DecisionInputSchema, ScenarioSeed, ScenarioSummary

Source = Literal["demo", "groq", "gemini", "openai"]


class AIProviderError(Exception):
    def __init__(self, message: str, code: str = "network") -> None:
        super().__init__(message)
        self.code = code


class DecisionAnalysis(BaseModel):
    category: str = Field(max_length=40)
    variables: list[str] = Field(default_factory=list, max_length=8)
    suggested_questions: list[str] = Field(default_factory=list, max_length=4)


class AIRecommendation(BaseModel):
    scenario_id: str
    take: str = Field(min_length=10, max_length=320)
    why: list[str] = Field(min_length=2, max_length=5)


class WhatIfInterpretation(BaseModel):
    summary: str = Field(max_length=120)
    overrides: dict[str, float]


class AIProvider(ABC):
    source: Source

    @abstractmethod
    def analyze_decision(self, input_: DecisionInputSchema) -> DecisionAnalysis: ...

    @abstractmethod
    def generate_scenarios(self, input_: DecisionInputSchema, count: int) -> list[ScenarioSeed]: ...

    @abstractmethod
    def explain_tradeoffs(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary]) -> str: ...

    @abstractmethod
    def generate_recommendation(self, input_: DecisionInputSchema, scenarios: list[ScenarioSummary], fallback: AIRecommendation) -> AIRecommendation: ...

    @abstractmethod
    def interpret_what_if(self, text: str, context: dict[str, object]) -> WhatIfInterpretation | None: ...

    @abstractmethod
    def generate_insight(self, patterns: list[str], outcomes: dict[str, int]) -> str | None: ...
