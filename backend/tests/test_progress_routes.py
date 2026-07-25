"""
Tests for app/progress/routes.py — proxy routes forwarding to Tamreena_AI's
progress-tracking and monthly-review API. httpx calls to WORKOUT_API_URL are
mocked with respx; these tests never require a live Tamreena_AI instance.
"""

import json

import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.auth import tokens
from app.config import WORKOUT_API_URL


@pytest.fixture(autouse=True)
def _isolated_secret(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def _client() -> TestClient:
    import app.main as m
    return TestClient(m.app)


def _auth_header() -> dict:
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    return {"Authorization": f"Bearer {token}"}


@respx.mock
def test_get_scans_forwards_token_and_passes_response_through():
    route = respx.get(f"{WORKOUT_API_URL}/progress/scans").mock(
        return_value=Response(200, json={"scans": [{"id": "abc"}]})
    )
    client = _client()
    auth = _auth_header()
    r = client.get("/api/progress/scans", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"scans": [{"id": "abc"}]}
    assert route.calls.last.request.headers["Authorization"] == auth["Authorization"]


@respx.mock
def test_get_scans_rejects_missing_token():
    client = _client()
    r = client.get("/api/progress/scans")
    assert r.status_code in (401, 403)


@respx.mock
def test_get_comparison_passes_null_through():
    respx.get(f"{WORKOUT_API_URL}/progress/comparison").mock(return_value=Response(200, json={"comparison": None}))
    client = _client()
    r = client.get("/api/progress/comparison", headers=_auth_header())
    assert r.status_code == 200
    assert r.json() == {"comparison": None}


@respx.mock
def test_get_report_passes_404_through():
    respx.get(f"{WORKOUT_API_URL}/progress/xyz/report").mock(
        return_value=Response(404, json={"detail": "No progress report for this session."})
    )
    client = _client()
    r = client.get("/api/progress/xyz/report", headers=_auth_header())
    assert r.status_code == 404
    assert r.json()["detail"] == "No progress report for this session."


@respx.mock
def test_get_report_passes_success_through():
    respx.get(f"{WORKOUT_API_URL}/progress/xyz/report").mock(
        return_value=Response(200, json={"old_session_id": "old", "new_session_id": "xyz", "narrative": "Great progress!"})
    )
    client = _client()
    r = client.get("/api/progress/xyz/report", headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["narrative"] == "Great progress!"


@respx.mock
def test_start_monthly_review_forwards_file_and_same_goal_true():
    route = respx.post(f"{WORKOUT_API_URL}/plan/xyz/monthly-review").mock(
        return_value=Response(200, json={"session_id": "new-session", "inbody": {}, "progress_report": "You improved!"})
    )
    client = _client()
    r = client.post(
        "/api/progress/xyz/monthly-review",
        headers=_auth_header(),
        files={"inbody_file": ("scan.jpg", b"fake-bytes", "image/jpeg")},
    )
    assert r.status_code == 200
    assert r.json()["progress_report"] == "You improved!"
    sent = route.calls.last.request
    assert b"same_goal" in sent.content
    assert b"true" in sent.content


@respx.mock
def test_start_monthly_review_passes_upstream_error_through():
    respx.post(f"{WORKOUT_API_URL}/plan/xyz/monthly-review").mock(
        return_value=Response(422, json={"detail": "This session is not eligible for a monthly review yet."})
    )
    client = _client()
    r = client.post(
        "/api/progress/xyz/monthly-review",
        headers=_auth_header(),
        files={"inbody_file": ("scan.jpg", b"fake-bytes", "image/jpeg")},
    )
    assert r.status_code == 422
    assert "eligible" in r.json()["detail"]
