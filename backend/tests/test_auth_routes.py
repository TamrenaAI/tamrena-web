"""
Tests for app/auth/routes.py — POST /auth/signup, POST /auth/login, GET /auth/me.
"""

import pytest
from fastapi.testclient import TestClient

from app.auth import tokens


@pytest.fixture(autouse=True)
def _isolated_state(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def _client() -> TestClient:
    import app.main as m
    return TestClient(m.app)


def _signup(client, username, password, confirm=None):
    return client.post("/auth/signup", json={
        "username": username,
        "password": password,
        "confirm_password": confirm if confirm is not None else password,
    })


def test_signup_creates_user_and_returns_session():
    client = _client()
    r = _signup(client, "testuser", "supersecret1")
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["username"] == "testuser"
    assert body["access_token"]
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_signup_rejects_mismatched_passwords():
    client = _client()
    r = _signup(client, "testuser2", "supersecret1", confirm="different1")
    assert r.status_code == 422


def test_signup_rejects_short_password():
    client = _client()
    r = _signup(client, "testuser3", "short1")
    assert r.status_code == 422


def test_signup_rejects_invalid_username():
    client = _client()
    r = _signup(client, "a b", "supersecret1")
    assert r.status_code == 422


def test_signup_rejects_duplicate_username_case_insensitive():
    client = _client()
    _signup(client, "DupeUser", "supersecret1")
    r = _signup(client, "dupeuser", "anotherpass1")
    assert r.status_code == 409


def test_login_with_correct_credentials():
    client = _client()
    _signup(client, "loginuser", "correctpass1")
    r = client.post("/auth/login", json={"username": "loginuser", "password": "correctpass1"})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "loginuser"


def test_login_is_case_insensitive_on_username():
    client = _client()
    _signup(client, "CaseUser", "correctpass1")
    r = client.post("/auth/login", json={"username": "CASEUSER", "password": "correctpass1"})
    assert r.status_code == 200


def test_login_rejects_wrong_password():
    client = _client()
    _signup(client, "wrongpassuser", "correctpass1")
    r = client.post("/auth/login", json={"username": "wrongpassuser", "password": "wrongpass1"})
    assert r.status_code == 401


def test_login_rejects_unknown_username():
    client = _client()
    r = client.post("/auth/login", json={"username": "nosuchuser", "password": "whatever1"})
    assert r.status_code == 401


def test_login_error_message_is_identical_for_unknown_user_and_wrong_password():
    client = _client()
    _signup(client, "sameerroruser", "correctpass1")
    r1 = client.post("/auth/login", json={"username": "sameerroruser", "password": "wrongpass1"})
    r2 = client.post("/auth/login", json={"username": "nosuchuser2", "password": "whatever1"})
    assert r1.json()["detail"] == r2.json()["detail"]


def test_get_me_with_valid_token():
    client = _client()
    token = _signup(client, "meuser", "correctpass1").json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "meuser"


def test_get_me_without_token_is_rejected():
    client = _client()
    r = client.get("/auth/me")
    assert r.status_code in (401, 403)


def test_get_me_created_at_is_tz_aware():
    client = _client()
    token = _signup(client, "tzuser", "correctpass1").json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    created_at = r.json()["created_at"]
    assert created_at.endswith("+00:00") or created_at.endswith("Z")
