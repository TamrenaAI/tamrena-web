"""
Tests for app/nutrition/routes.py's SSE generation-progress stream proxy
(stream_nutrition_progress). Mirrors app/workout/routes.py's stream_plan
tests — same proxy pattern, different upstream, no auth forwarded.
"""

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.auth import tokens
from app.config import NUTRITION_API_URL


def _client() -> TestClient:
    import app.main as m
    return TestClient(m.app)


@respx.mock
def test_stream_relays_upstream_sse_body_and_omits_auth_header():
    route = respx.get(f"{NUTRITION_API_URL}/api/v1/nutrition/stream/abc123").mock(
        return_value=Response(
            200,
            content=b'data: {"run_id": "abc123", "node": "profile", "status": "completed", "progress": 100}\n\n',
            headers={"content-type": "text/event-stream"},
        )
    )
    client = _client()
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get(f"/api/nutrition/stream/abc123?token={token}")
    assert r.status_code == 200
    assert b'"status": "completed"' in r.content
    assert "Authorization" not in route.calls.last.request.headers


def test_stream_rejects_missing_token():
    client = _client()
    r = client.get("/api/nutrition/stream/abc123")
    assert r.status_code == 401


@respx.mock
def test_stream_returns_json_error_not_sse_when_upstream_errors():
    respx.get(f"{NUTRITION_API_URL}/api/v1/nutrition/stream/unknown").mock(
        return_value=Response(404, json={"detail": "Unknown run_id."})
    )
    client = _client()
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    r = client.get(f"/api/nutrition/stream/unknown?token={token}")
    assert r.status_code == 404
    assert r.json() == {"detail": "Unknown run_id."}
    assert "text/event-stream" not in r.headers.get("content-type", "")
