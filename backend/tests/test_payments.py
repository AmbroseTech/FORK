from __future__ import annotations

import hashlib
import hmac
import json
import uuid

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.models import PaymentStatus
from app.services.payments.providers import MTNProvider, PaymentProviderError
from tests.conftest import signup


def _initiate(client: TestClient, headers: dict, key: str | None = None) -> dict:
    r = client.post(
        "/api/payments/initiate",
        json={"plan_code": "WEEKLY", "provider": "MTN", "phone": "0772123456", "idempotency_key": key or uuid.uuid4().hex},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_methods_cards_disabled(client: TestClient) -> None:
    methods = client.get("/api/payments/methods").json()
    by_id = {m["id"]: m for m in methods}
    assert by_id["MTN"]["enabled"] and by_id["AIRTEL"]["enabled"]
    assert not by_id["VISA"]["enabled"] and by_id["VISA"]["note"] == "Coming soon"


def test_demo_payment_does_not_auto_activate(client: TestClient) -> None:
    _, headers = signup(client)
    body = _initiate(client, headers)
    p = body["payment"]
    assert p["status"] == "PROCESSING" and p["is_demo"] is True
    assert "DEMO" in body["instructions"]
    assert p["payer_phone_masked"].endswith("456") and "*" in p["payer_phone_masked"] and "0772123456" not in json.dumps(body)
    assert "pin" not in json.dumps(body).lower()

    # verifying a demo payment keeps it processing — nothing succeeds by itself
    v = client.post(f"/api/payments/{p['id']}/verify", headers=headers).json()
    assert v["status"] == "PROCESSING"
    assert client.get("/api/usage", headers=headers).json()["plan_code"] == "FREE"

    ok = client.post(f"/api/payments/{p['id']}/demo-confirm", json={"approve": True}, headers=headers).json()
    assert ok["status"] == "SUCCESS" and ok["verified_at"]
    usage = client.get("/api/usage", headers=headers).json()
    assert usage["plan_code"] == "WEEKLY" and usage["status"] == "ACTIVE" and usage["daily_limit"] > 3

    notes = client.get("/api/notifications", headers=headers).json()
    assert any(n["type"] == "SUBSCRIPTION" for n in notes["items"])


def test_demo_decline_and_cancel(client: TestClient) -> None:
    _, headers = signup(client)
    p = _initiate(client, headers)["payment"]
    dec = client.post(f"/api/payments/{p['id']}/demo-confirm", json={"approve": False}, headers=headers).json()
    assert dec["status"] == "FAILED"
    assert client.get("/api/usage", headers=headers).json()["plan_code"] == "FREE"
    # terminal state cannot move
    assert client.post(f"/api/payments/{p['id']}/demo-confirm", json={"approve": True}, headers=headers).status_code == 400

    p2 = _initiate(client, headers)["payment"]
    assert client.post(f"/api/payments/{p2['id']}/cancel", headers=headers).json()["status"] == "CANCELLED"


def test_idempotency_and_isolation(client: TestClient) -> None:
    _, headers = signup(client)
    key = uuid.uuid4().hex
    a = _initiate(client, headers, key)["payment"]
    b = _initiate(client, headers, key)["payment"]
    assert a["id"] == b["id"]
    assert len(client.get("/api/payments", headers=headers).json()) == 1

    _, other = signup(client)
    assert client.get(f"/api/payments/{a['id']}", headers=other).status_code == 404


def test_free_plan_and_bad_provider_rejected(client: TestClient) -> None:
    _, headers = signup(client)
    r = client.post(
        "/api/payments/initiate", json={"plan_code": "FREE", "provider": "MTN", "phone": "0772123456", "idempotency_key": "x" * 12}, headers=headers
    )
    assert r.status_code == 422
    r = client.post(
        "/api/payments/initiate", json={"plan_code": "WEEKLY", "provider": "VISA", "phone": "0772123456", "idempotency_key": "x" * 12}, headers=headers
    )
    assert r.status_code == 422


def test_webhook_signature_required() -> None:
    settings = Settings(mtn_webhook_secret="topsecret-topsecret", mtn_merchant_number="256700000000", payments_demo=False)
    provider = MTNProvider(settings)
    body = json.dumps({"externalId": str(uuid.uuid4()), "status": "SUCCESSFUL", "financialTransactionId": "abc"}).encode()
    try:
        provider.parse_webhook({}, body)
        raise AssertionError("unsigned webhook accepted")
    except PaymentProviderError:
        pass
    sig = hmac.new(b"topsecret-topsecret", body, hashlib.sha256).hexdigest()
    event = provider.parse_webhook({"x-fork-signature": sig}, body)
    assert event.status == PaymentStatus.SUCCESS


def test_webhook_endpoint_rejects_unsigned(client: TestClient) -> None:
    r = client.post("/api/payments/webhooks/mtn", content=b"{}", headers={"content-type": "application/json"})
    assert r.status_code in (400, 401, 502)
    assert client.post("/api/payments/webhooks/visa", content=b"{}").status_code == 404
