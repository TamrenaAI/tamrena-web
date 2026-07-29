"""
Tests for app/live_session/routes.py's HTTP routes: the video upload
proxy and the result-persistence route. The WebSocket proxy route is
tested separately in test_live_session_ws.py.
"""

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.auth import tokens
from app.config import CV_API_URL, LIVE_SESSIONS_TABLE_NAME


def _client() -> TestClient:
    import app.main as m
    return TestClient(m.app)


def _auth_header() -> dict:
    token = tokens.create_access_token(user_id="507f1f77bcf86cd799439011")
    return {"Authorization": f"Bearer {token}"}


@respx.mock
def test_upload_forwards_file_and_omits_auth_header():
    route = respx.post(f"{CV_API_URL}/api/uploads").mock(
        return_value=Response(201, json={"id": "abc123__clip.mp4", "name": "clip.mp4", "size": 1024})
    )
    client = _client()
    r = client.post(
        "/api/live-session/upload",
        headers=_auth_header(),
        files={"file": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
    )
    assert r.status_code == 201
    assert r.json()["id"] == "abc123__clip.mp4"
    assert "Authorization" not in route.calls.last.request.headers


def test_upload_rejects_missing_bff_token():
    client = _client()
    r = client.post("/api/live-session/upload", files={"file": ("clip.mp4", b"x", "video/mp4")})
    assert r.status_code in (401, 403)


def test_save_result_persists_and_returns_item(dynamo_table):
    client = _client()
    body = {"exercise_id": "biceps_curl", "exercise_name": "Biceps Curl", "reps": 8, "good": 6, "bad": 2}
    r = client.post("/api/live-session/result", json=body, headers=_auth_header())
    assert r.status_code == 200
    result = r.json()
    assert result["exercise_id"] == "biceps_curl"
    assert result["reps"] == 8
    assert len(result["session_id"]) == 24

    table = dynamo_table.Table(LIVE_SESSIONS_TABLE_NAME)
    stored = table.get_item(Key={"session_id": result["session_id"]}).get("Item")
    assert stored is not None
    assert stored["good"] == 6


def test_save_result_rejects_missing_bff_token():
    client = _client()
    body = {"exercise_id": "x", "exercise_name": "X", "reps": 0, "good": 0, "bad": 0}
    r = client.post("/api/live-session/result", json=body)
    assert r.status_code in (401, 403)


@respx.mock
def test_get_report_forwards_to_cv_sessions_endpoint():
    route = respx.get(f"{CV_API_URL}/api/sessions/abc123").mock(
        return_value=Response(200, json={
            "summary": {"total_reps": 8, "good_reps": 6, "bad_reps": 2, "score": 82},
            "history": [{"number": 1, "score": 90, "good": True}],
            "rules": [],
        })
    )
    client = _client()
    r = client.get("/api/live-session/report/abc123", headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["summary"]["total_reps"] == 8
    assert route.called


@respx.mock
def test_get_report_passes_through_404_from_cv():
    respx.get(f"{CV_API_URL}/api/sessions/missing").mock(
        return_value=Response(404, json={"detail": "Unknown session 'missing'"})
    )
    client = _client()
    r = client.get("/api/live-session/report/missing", headers=_auth_header())
    assert r.status_code == 404


def test_get_report_rejects_missing_bff_token():
    client = _client()
    r = client.get("/api/live-session/report/abc123")
    assert r.status_code in (401, 403)
