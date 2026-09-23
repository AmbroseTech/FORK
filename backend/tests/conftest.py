from __future__ import annotations

import os
import uuid
from collections.abc import Iterator

os.environ.update(
    {
        "APP_ENV": "test",
        "DEMO_MODE": "true",
        "PAYMENTS_DEMO": "true",
        "DATABASE_URL": "sqlite+pysqlite:///:memory:",
        "REDIS_URL": "redis://127.0.0.1:1/0",  # unreachable on purpose -> in-memory fallback
        "JWT_SECRET": "test-secret-test-secret-test-secret",
        "RATE_LIMIT_PER_MINUTE": "10000",
        "AUTH_RATE_LIMIT_PER_MINUTE": "10000",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.cache import get_cache  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_engine, get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402
from app.services.subscriptions import ensure_default_plans  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db() -> Iterator[None]:
    engine = get_engine()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with get_sessionmaker()() as db:
        ensure_default_plans(db)
    get_cache()._memory._data.clear()
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def signup(client: TestClient, email: str | None = None, password: str = "Password123!") -> tuple[dict, dict]:
    email = email or f"{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/auth/signup",
        json={"email": email, "username": f"u{uuid.uuid4().hex[:8]}", "password": password, "accept_terms": True},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    return data, {"Authorization": f"Bearer {data['tokens']['access_token']}"}


DECISION = {
    "decision": "Should I buy a laptop now or keep saving?",
    "priorities": ["money", "education"],
    "context": {
        "currency": "UGX",
        "savings": 2000000,
        "cost": 1500000,
        "monthlyIncome": 500000,
        "monthlyExpenses": 280000,
        "goal": "University expenses",
        "goalAmount": 3000000,
        "horizonMonths": 6,
    },
}


def scenario(letter: str, sid: str, score: int, delay: float = 0) -> dict:
    return {
        "id": sid,
        "letter": letter,
        "title": f"Path {letter}",
        "description": "A plausible route forward with its own costs.",
        "advantages": ["Upside"],
        "tradeoffs": ["Downside"],
        "modifiers": {"delayMonths": delay},
        "metrics": {"financial": 60, "opportunity": 70, "risk": 40, "flexibility": 50},
        "timeline": [],
        "score": score,
        "projectedBalance": 1000000,
        "minBalance": 500000,
    }


def decision_payload(**over: object) -> dict:
    payload = {
        "input": DECISION,
        "overrides": {},
        "scenarios": [scenario("A", "a", 72), scenario("B", "b", 61, delay=3)],
        "recommendation": {"scenarioId": "a", "take": "Buy now, keep the buffer.", "why": ["Buffer holds", "Goal on track"]},
        "confidence": {"level": "HIGH", "present": ["savings", "cost"], "missing": []},
        "source": "demo",
        "category": "Purchase",
    }
    payload.update(over)
    return payload
