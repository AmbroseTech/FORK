from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import DECISION, decision_payload, signup


def test_trials_then_daily_limit(client: TestClient) -> None:
    _, headers = signup(client)
    usage = client.get("/api/usage", headers=headers).json()
    assert usage["trial_remaining"] == 5 and usage["daily_limit"] == 3 and usage["status"] == "TRIAL"

    for _ in range(5):
        r = client.post("/api/simulate/seed", json=DECISION, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["source"] == "demo"
        assert 2 <= len(body["scenarios"]) <= 3
    usage = client.get("/api/usage", headers=headers).json()
    assert usage["trial_remaining"] == 0 and usage["daily_used"] == 0 and usage["status"] == "FREE"

    for used in range(1, 4):
        assert client.post("/api/simulate/seed", json=DECISION, headers=headers).status_code == 200
        assert client.get("/api/usage", headers=headers).json()["remaining_today"] == 3 - used

    blocked = client.post("/api/simulate/seed", json=DECISION, headers=headers)
    assert blocked.status_code == 402
    assert blocked.json()["detail"] == "usage_limit_reached"
    assert blocked.json()["usage"]["daily_used"] == 3

    # a trial-exhaustion notification was created
    notes = client.get("/api/notifications", headers=headers).json()
    assert any(n["type"] == "TRIAL" for n in notes["items"])


def test_seed_is_deterministic_in_demo(client: TestClient) -> None:
    _, headers = signup(client)
    a = client.post("/api/simulate/seed", json=DECISION, headers=headers).json()
    b = client.post("/api/simulate/seed", json=DECISION, headers=headers).json()
    assert a == b
    assert a["category"] == "Money"


def test_recommend_uses_fallback_in_demo(client: TestClient) -> None:
    _, headers = signup(client)
    r = client.post(
        "/api/simulate/recommend",
        json={
            "input": DECISION,
            "scenarios": [
                {"id": "a", "letter": "A", "title": "Buy now", "score": 72, "metrics": {}, "projectedBalance": 1, "minBalance": 1},
                {"id": "b", "letter": "B", "title": "Wait", "score": 60, "metrics": {}, "projectedBalance": 1, "minBalance": 1},
            ],
            "fallback": {"scenarioId": "a", "take": "Buy now, keep the buffer.", "why": ["one", "two"]},
        },
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["recommendation"]["scenarioId"] == "a"


def test_decision_lifecycle_and_insights(client: TestClient) -> None:
    _, headers = signup(client)
    ins = client.get("/api/insights", headers=headers).json()
    assert ins["enough_data"] is False and ins["patterns"] == []

    created = client.post("/api/decisions", json=decision_payload(), headers=headers)
    assert created.status_code == 201, created.text
    d = created.json()
    assert d["status"] == "PENDING" and len(d["scenarios"]) == 2 and d["scenarios"][0]["id"] == "a"

    other, _ = signup(client)
    other_headers = {"Authorization": f"Bearer {other['tokens']['access_token']}"}
    assert client.get(f"/api/decisions/{d['id']}", headers=other_headers).status_code == 404

    dec = client.post(f"/api/decisions/{d['id']}/decide", json={"scenarioId": "b"}, headers=headers)
    assert dec.status_code == 200 and dec.json()["status"] == "DECIDED" and dec.json()["chosenScenarioId"] == "b"
    assert client.post(f"/api/decisions/{d['id']}/decide", json={"scenarioId": "zzz"}, headers=headers).status_code == 400

    out = client.post(f"/api/decisions/{d['id']}/outcome", json={"rating": "worse", "note": "Cost more"}, headers=headers)
    assert out.status_code == 200 and out.json()["status"] == "REVIEWED" and out.json()["outcomeRating"] == "WORSE"

    wi = client.post(
        f"/api/decisions/{d['id']}/what-if",
        json={
            "prompt": "expenses +15%",
            "context": DECISION["context"],
            "ruleSummary": "Expenses +15%",
            "ruleOverrides": {"monthlyExpenses": 322000},
            "resultScores": {"a": 70},
        },
        headers=headers,
    )
    assert wi.status_code == 201
    assert len(client.get(f"/api/decisions/{d['id']}", headers=headers).json()["whatIfs"]) == 1

    second = client.post("/api/decisions", json=decision_payload(), headers=headers).json()
    client.post(f"/api/decisions/{second['id']}/decide", json={"scenarioId": "a"}, headers=headers)
    ins = client.get("/api/insights", headers=headers).json()
    assert ins["enough_data"] is True
    ids = {p["id"] for p in ins["patterns"]}
    assert "follow" in ids
    assert ins["stats"]["decided"] == 2 and ins["stats"]["outcomes"]["worse"] == 1

    lst = client.get("/api/decisions", params={"q": "laptop"}, headers=headers).json()
    assert lst["total"] == 2
    assert client.get("/api/decisions", params={"status": "REVIEWED"}, headers=headers).json()["total"] == 1

    arch = client.patch(f"/api/decisions/{second['id']}", json={"isArchived": True}, headers=headers)
    assert arch.status_code == 200 and arch.json()["isArchived"] is True
    assert client.get("/api/decisions", headers=headers).json()["total"] == 1
    assert client.get("/api/decisions", params={"archived": True}, headers=headers).json()["total"] == 1

    assert client.delete(f"/api/decisions/{d['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/decisions/{d['id']}", headers=headers).status_code == 404


def test_what_if_interpret_rules_first_then_gate(client: TestClient) -> None:
    _, headers = signup(client)
    r = client.post(
        "/api/what-if/interpret",
        json={"prompt": "wait 3 months", "context": DECISION["context"], "ruleSummary": "Delay 3 months", "ruleOverrides": {"delayMonths": 3}},
        headers=headers,
    )
    assert r.status_code == 200 and r.json()["source"] == "rules"
    # free plan cannot use AI custom what-if
    r = client.post("/api/what-if/interpret", json={"prompt": "what if my cousin helps", "context": DECISION["context"]}, headers=headers)
    assert r.status_code == 402
