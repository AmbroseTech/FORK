from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import signup


def test_signup_login_refresh_logout(client: TestClient) -> None:
    data, headers = signup(client, "ann@example.com")
    assert data["user"]["email"] == "ann@example.com"
    assert data["user"]["trial_simulations_remaining"] == 5
    assert data["user"]["email_verified"] is False
    assert "password" not in data["user"]

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["email"] == "ann@example.com"

    login = client.post("/api/auth/login", json={"email": "ann@example.com", "password": "Password123!"})
    assert login.status_code == 200
    refresh_token = login.json()["tokens"]["refresh_token"]

    rotated = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert rotated.status_code == 200
    assert rotated.json()["refresh_token"] != refresh_token

    # rotation: old refresh token is now revoked
    reused = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert reused.status_code == 401

    new_refresh = rotated.json()["refresh_token"]
    out = client.post("/api/auth/logout", json={"refresh_token": new_refresh}, headers=headers)
    assert out.status_code == 200
    assert client.post("/api/auth/refresh", json={"refresh_token": new_refresh}).status_code == 401


def test_signup_requires_terms_and_unique_email(client: TestClient) -> None:
    r = client.post("/api/auth/signup", json={"email": "x@example.com", "username": "xuser", "password": "Password123!", "accept_terms": False})
    assert r.status_code == 422
    signup(client, "dup@example.com")
    r = client.post("/api/auth/signup", json={"email": "dup@example.com", "username": "other1", "password": "Password123!", "accept_terms": True})
    assert r.status_code == 409


def test_wrong_password_and_unauthenticated(client: TestClient) -> None:
    signup(client, "bob@example.com")
    assert client.post("/api/auth/login", json={"email": "bob@example.com", "password": "nope-nope-nope"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_password_reset_flow(client: TestClient) -> None:
    signup(client, "reset@example.com")
    r = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
    assert r.status_code == 200
    token = r.json()["dev_token"]  # only exposed outside production
    assert token
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "NewPassword456!"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "Another789!"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "reset@example.com", "password": "NewPassword456!"}).status_code == 200
    # unknown email does not leak existence
    assert client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"}).status_code == 200


def test_email_verification(client: TestClient) -> None:
    data, headers = signup(client, "verify@example.com")
    token = data["dev_verification_token"]
    assert token
    assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert client.get("/api/auth/me", headers=headers).json()["email_verified"] is True


def test_profile_update(client: TestClient) -> None:
    _, headers = signup(client)
    r = client.patch("/api/profiles/me", json={"display_name": "Ann A.", "bio": "Deciding things", "interests": ["finance"]}, headers=headers)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Ann A."
    assert r.json()["interests"] == ["finance"]
