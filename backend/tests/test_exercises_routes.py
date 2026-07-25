"""
Tests for app/exercises/routes.py — proxy routes forwarding to both
Tamreena_AI's exercise catalogue (WORKOUT_API_URL) and the Computer-Vision
service's exercise catalogue (CV_API_URL, no auth). httpx calls are mocked
with respx; these tests never require a live upstream service.
"""

import pytest
import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.auth import tokens
from app.config import CV_API_URL, WORKOUT_API_URL


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
def test_list_tamreena_exercises_forwards_token_and_passes_response_through():
    route = respx.get(f"{WORKOUT_API_URL}/exercises").mock(
        return_value=Response(200, json={"exercises": [], "total": 0, "page": 0, "page_size": 30})
    )
    client = _client()
    auth = _auth_header()
    r = client.get("/api/exercises", headers=auth)
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert route.calls.last.request.headers["Authorization"] == auth["Authorization"]


@respx.mock
def test_list_tamreena_exercises_rejects_missing_token():
    client = _client()
    r = client.get("/api/exercises")
    assert r.status_code in (401, 403)


@respx.mock
def test_lookup_tamreena_exercise_forwards_name_param():
    route = respx.get(f"{WORKOUT_API_URL}/exercises/lookup").mock(
        return_value=Response(200, json={"name": "barbell curl", "target_muscle": "biceps"})
    )
    client = _client()
    r = client.get("/api/exercises/lookup", params={"name": "barbell curl"}, headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["name"] == "barbell curl"
    assert route.calls.last.request.url.params["name"] == "barbell curl"


@respx.mock
def test_lookup_tamreena_exercise_passes_404_through():
    respx.get(f"{WORKOUT_API_URL}/exercises/lookup").mock(
        return_value=Response(404, json={"detail": "No matching exercise found for 'xyz'."})
    )
    client = _client()
    r = client.get("/api/exercises/lookup", params={"name": "xyz"}, headers=_auth_header())
    assert r.status_code == 404


@respx.mock
def test_list_cv_exercises_omits_authorization_header():
    route = respx.get(f"{CV_API_URL}/api/exercises").mock(
        return_value=Response(200, json=[{"id": "squat", "name": "Squat"}])
    )
    client = _client()
    r = client.get("/api/exercises/cv", headers=_auth_header())
    assert r.status_code == 200
    assert r.json() == [{"id": "squat", "name": "Squat"}]
    assert "Authorization" not in route.calls.last.request.headers


@respx.mock
def test_list_cv_exercises_rejects_missing_bff_token():
    client = _client()
    r = client.get("/api/exercises/cv")
    assert r.status_code in (401, 403)


@respx.mock
def test_media_proxy_forwards_bytes_and_content_type():
    respx.get(f"{WORKOUT_API_URL}/media/exercises/gifs/curl.gif").mock(
        return_value=Response(200, content=b"fake-gif-bytes", headers={"content-type": "image/gif"})
    )
    client = _client()
    r = client.get("/media/exercises/gifs/curl.gif")
    assert r.status_code == 200
    assert r.content == b"fake-gif-bytes"
    assert r.headers["content-type"] == "image/gif"


@respx.mock
def test_media_proxy_passes_404_through():
    respx.get(f"{WORKOUT_API_URL}/media/exercises/gifs/missing.gif").mock(return_value=Response(404))
    client = _client()
    r = client.get("/media/exercises/gifs/missing.gif")
    assert r.status_code == 404


@respx.mock
def test_media_proxy_does_not_require_bff_token():
    respx.get(f"{WORKOUT_API_URL}/media/exercises/gifs/curl.gif").mock(
        return_value=Response(200, content=b"fake-gif-bytes", headers={"content-type": "image/gif"})
    )
    client = _client()
    r = client.get("/media/exercises/gifs/curl.gif")
    assert r.status_code == 200


@respx.mock
def test_media_proxy_rejects_path_traversal():
    # The httpx-based TestClient normalizes ".." segments in the URL *before*
    # the request is ever sent to the ASGI app, so this request never reaches
    # our route handler at all — it resolves to this BFF's own (intentionally
    # public) /openapi.json route instead. That is a safe outcome: no request
    # reaches the media proxy handler, so no traversal to WORKOUT_API_URL is
    # possible via this path. We assert on that safe outcome here, and cover
    # the case where the raw path DOES reach our handler (e.g. a client that
    # doesn't normalize, or a percent-encoded path) below.
    client = _client()
    r = client.get("/media/exercises/../../openapi.json")
    assert r.status_code == 200
    # Prove it's the BFF's own openapi doc (this BFF's routes), not anything
    # forwarded from the upstream — i.e. no proxy call happened.
    assert "/api/exercises" in r.json()["paths"]


@respx.mock
def test_media_proxy_rejects_url_encoded_path_traversal():
    client = _client()
    r = client.get("/media/exercises/%2e%2e/%2e%2e/openapi.json")
    assert r.status_code in (400, 404)
