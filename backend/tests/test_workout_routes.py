"""
Tests for app/workout/routes.py — proxy routes forwarding to Tamreena_AI's
API. httpx calls to WORKOUT_API_URL are mocked with respx; these tests never
require a live Tamreena_AI instance.
"""

import json

import httpx
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
def test_list_sessions_forwards_token_and_passes_response_through():
    route = respx.get(f"{WORKOUT_API_URL}/sessions").mock(
        return_value=Response(200, json={"sessions": [{"session_id": "abc"}]})
    )
    client = _client()
    auth = _auth_header()
    r = client.get("/api/workout/sessions", headers=auth)
    assert r.status_code == 200
    assert r.json() == {"sessions": [{"session_id": "abc"}]}
    assert route.calls.last.request.headers["Authorization"] == auth["Authorization"]


@respx.mock
def test_list_sessions_rejects_missing_token():
    client = _client()
    r = client.get("/api/workout/sessions")
    assert r.status_code in (401, 403)


@respx.mock
def test_list_sessions_passes_upstream_error_through():
    respx.get(f"{WORKOUT_API_URL}/sessions").mock(return_value=Response(500, json={"detail": "boom"}))
    client = _client()
    r = client.get("/api/workout/sessions", headers=_auth_header())
    assert r.status_code == 500
    assert r.json() == {"detail": "boom"}


@respx.mock
def test_get_session_plan_forwards_session_id():
    respx.get(f"{WORKOUT_API_URL}/sessions/xyz/plan").mock(
        return_value=Response(200, json={"status": "ready", "plan": "## Week 1"})
    )
    client = _client()
    r = client.get("/api/workout/sessions/xyz/plan", headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["plan"] == "## Week 1"


@respx.mock
def test_submit_feedback_forwards_json_body():
    route = respx.post(f"{WORKOUT_API_URL}/workouts/xyz/feedback").mock(
        return_value=Response(
            200,
            json={"feedback_recorded": True, "adjustment_triggered": False, "summary": None, "adjustments": []},
        )
    )
    client = _client()
    body = {"day_label": "Day 1", "exercises": [{"name": "Squat", "difficulty": "just_right"}]}
    r = client.post("/api/workout/feedback/xyz", json=body, headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["adjustment_triggered"] is False
    assert json.loads(route.calls.last.request.content) == body


@respx.mock
def test_validate_image_forwards_multipart_file():
    respx.post(f"{WORKOUT_API_URL}/validate-image").mock(
        return_value=Response(200, json={"valid": True, "stage": None, "issue": None})
    )
    client = _client()
    r = client.post(
        "/api/workout/validate-image",
        headers=_auth_header(),
        files={"file": ("scan.jpg", b"fake-bytes", "image/jpeg")},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is True


@respx.mock
def test_generate_plan_forwards_file_and_form_fields():
    route = respx.post(f"{WORKOUT_API_URL}/generate-plan").mock(
        return_value=Response(200, json={"session_id": "new-session", "inbody": {}})
    )
    client = _client()
    r = client.post(
        "/api/workout/generate-plan",
        headers=_auth_header(),
        files={"inbody_file": ("scan.jpg", b"fake-bytes", "image/jpeg")},
        data={"goal": "muscle_gain", "days_per_week": "4", "experience": "beginner", "session_duration": "60min"},
    )
    assert r.status_code == 200
    assert r.json()["session_id"] == "new-session"
    assert b"muscle_gain" in route.calls.last.request.content


@respx.mock
def test_generate_plan_passes_upstream_validation_error_through():
    respx.post(f"{WORKOUT_API_URL}/generate-plan").mock(
        return_value=Response(422, json={"detail": "InBody scan rejected at [blur]: too blurry"})
    )
    client = _client()
    r = client.post(
        "/api/workout/generate-plan",
        headers=_auth_header(),
        files={"inbody_file": ("scan.jpg", b"fake-bytes", "image/jpeg")},
        data={"goal": "muscle_gain", "days_per_week": "4", "experience": "beginner", "session_duration": "60min"},
    )
    assert r.status_code == 422
    assert "blur" in r.json()["detail"]


@respx.mock
def test_stream_plan_relays_upstream_sse_body():
    respx.get(f"{WORKOUT_API_URL}/generate-plan/stream/xyz").mock(
        return_value=Response(
            200,
            content=b'data: {"type": "done", "plan": "ok"}\n\n',
            headers={"content-type": "text/event-stream"},
        )
    )
    client = _client()
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get(f"/api/workout/generate-plan/stream/xyz?token={token}")
    assert r.status_code == 200
    assert b'"type": "done"' in r.content


@respx.mock
def test_stream_plan_rejects_missing_token():
    client = _client()
    r = client.get("/api/workout/generate-plan/stream/xyz")
    assert r.status_code == 401


@respx.mock
def test_list_sessions_returns_502_on_upstream_connection_failure():
    respx.get(f"{WORKOUT_API_URL}/sessions").mock(side_effect=httpx.ConnectError("connection refused"))
    client = _client()
    r = client.get("/api/workout/sessions", headers=_auth_header())
    assert r.status_code == 502
    assert "unavailable" in r.json()["detail"].lower()


@respx.mock
def test_list_sessions_returns_json_envelope_when_upstream_body_is_not_json():
    respx.get(f"{WORKOUT_API_URL}/sessions").mock(
        return_value=Response(200, content=b"<html>not json</html>", headers={"content-type": "text/html"})
    )
    client = _client()
    r = client.get("/api/workout/sessions", headers=_auth_header())
    assert r.status_code == 200
    assert r.json() == {"detail": "<html>not json</html>"}


@respx.mock
def test_stream_plan_returns_json_error_not_sse_when_upstream_errors():
    respx.get(f"{WORKOUT_API_URL}/generate-plan/stream/xyz").mock(
        return_value=Response(404, json={"detail": "Unknown session_id."})
    )
    client = _client()
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get(f"/api/workout/generate-plan/stream/xyz?token={token}")
    assert r.status_code == 404
    assert r.json() == {"detail": "Unknown session_id."}
    assert "text/event-stream" not in r.headers.get("content-type", "")
