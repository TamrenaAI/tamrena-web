"""
Tests for app/auth/dependencies.py's token-passthrough dependencies —
get_verified_token and get_verified_token_for_stream (used by the workout
proxy routes, which need the raw token to forward, not this service's own
user record).
"""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import tokens
from app.auth.dependencies import get_verified_token, get_verified_token_for_stream


@pytest.fixture(autouse=True)
def _isolated_secret(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def _test_app() -> FastAPI:
    app = FastAPI()

    @app.get("/needs-token")
    def needs_token(token: str = Depends(get_verified_token)):
        return {"token": token}

    @app.get("/needs-token-stream")
    def needs_token_stream(token: str = Depends(get_verified_token_for_stream)):
        return {"token": token}

    return app


def test_get_verified_token_returns_raw_token_for_valid_bearer():
    client = TestClient(_test_app())
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get("/needs-token", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["token"] == token


def test_get_verified_token_rejects_missing_header():
    client = TestClient(_test_app())
    r = client.get("/needs-token")
    assert r.status_code in (401, 403)


def test_get_verified_token_rejects_invalid_token():
    client = TestClient(_test_app())
    r = client.get("/needs-token", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_get_verified_token_for_stream_accepts_query_param():
    client = TestClient(_test_app())
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get(f"/needs-token-stream?token={token}")
    assert r.status_code == 200
    assert r.json()["token"] == token


def test_get_verified_token_for_stream_accepts_bearer_header():
    client = TestClient(_test_app())
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get("/needs-token-stream", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


def test_get_verified_token_for_stream_rejects_missing_token():
    client = TestClient(_test_app())
    r = client.get("/needs-token-stream")
    assert r.status_code == 401
