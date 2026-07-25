"""
Tests for app/auth/routes.py — POST /auth/google, POST /auth/dev-login,
GET /auth/me.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.auth import routes as auth_routes
from app.auth import tokens


@pytest.fixture(autouse=True)
def _isolated_state(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def test_dev_login_disabled_by_default(monkeypatch):
    import app.main as m

    monkeypatch.setattr(auth_routes, "ALLOW_DEV_LOGIN", False)
    client = TestClient(m.app)
    r = client.post("/auth/dev-login")
    assert r.status_code == 404


def test_dev_login_works_when_enabled(monkeypatch):
    import app.main as m

    monkeypatch.setattr(auth_routes, "ALLOW_DEV_LOGIN", True)
    client = TestClient(m.app)
    r = client.post("/auth/dev-login")
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "dev@tamreena.local"
    assert body["access_token"]


def test_get_me_with_dev_login_token(monkeypatch):
    import app.main as m

    monkeypatch.setattr(auth_routes, "ALLOW_DEV_LOGIN", True)
    client = TestClient(m.app)
    token = client.post("/auth/dev-login").json()["access_token"]

    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "dev@tamreena.local"


def test_get_me_without_token_is_rejected():
    import app.main as m

    client = TestClient(m.app)
    r = client.get("/auth/me")
    assert r.status_code in (401, 403)


def test_google_sign_in_creates_user_from_verified_claims(monkeypatch):
    import app.main as m

    fake_claims = {
        "sub": "google-sub-123",
        "email": "real-user@example.com",
        "name": "Real User",
        "picture": "https://example.com/pic.jpg",
        "email_verified": True,
    }
    with patch("app.auth.routes.verify_google_id_token", return_value=fake_claims):
        client = TestClient(m.app)
        r = client.post("/auth/google", json={"id_token": "fake-but-verified-token"})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == "real-user@example.com"
        assert body["access_token"]
