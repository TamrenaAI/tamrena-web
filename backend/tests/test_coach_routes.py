"""Tests for app/coach/routes.py's proxy route: looks up the user's last
nutrition run_id, fetches that plan's result if one exists, and forwards
both the chat message and that snapshot to Tamrena-Workout's real
/coach/chat. Mirrors tests/test_nutrition_routes.py's respx mocking
pattern; DynamoDB access is moto-mocked per-test via the autouse
dynamo_table fixture in tests/conftest.py."""

import json

import respx
from fastapi.testclient import TestClient
from httpx import Response

from app.auth import tokens
from app.auth.models import create_user, set_last_nutrition_run_id
from app.config import NUTRITION_API_URL, WORKOUT_API_URL


def _client() -> TestClient:
    import app.main as m
    return TestClient(m.app)


def _auth_header_for(user_id: str) -> dict:
    token = tokens.create_access_token(user_id=user_id)
    return {"Authorization": f"Bearer {token}"}


@respx.mock
def test_coach_chat_forwards_message_and_null_snapshot_when_no_nutrition_plan():
    user = create_user(username="chatuser1", password="supersecret1")
    route = respx.post(f"{WORKOUT_API_URL}/coach/chat").mock(
        return_value=Response(200, json={"response": "Looks like a solid leg day."})
    )

    client = _client()
    r = client.post(
        "/api/coach/chat",
        json={"message": "what's next on leg day?"},
        headers=_auth_header_for(user["id"]),
    )

    assert r.status_code == 200
    assert r.json() == {"response": "Looks like a solid leg day."}
    sent_body = json.loads(route.calls.last.request.read())
    assert sent_body == {"message": "what's next on leg day?", "nutrition_plan_snapshot": None}
    assert "Authorization" in route.calls.last.request.headers


@respx.mock
def test_coach_chat_fetches_and_forwards_nutrition_snapshot_when_run_id_exists():
    user = create_user(username="chatuser2", password="supersecret1")
    set_last_nutrition_run_id(user["id"], "run-abc123")

    respx.get(f"{NUTRITION_API_URL}/api/v1/nutrition/result/run-abc123").mock(
        return_value=Response(200, json={"run_id": "run-abc123", "success": True, "error": None})
    )
    route = respx.post(f"{WORKOUT_API_URL}/coach/chat").mock(
        return_value=Response(200, json={"response": "Yes, that fits."})
    )

    client = _client()
    r = client.post(
        "/api/coach/chat",
        json={"message": "does chicken and rice fit my plan?"},
        headers=_auth_header_for(user["id"]),
    )

    assert r.status_code == 200
    sent_body = json.loads(route.calls.last.request.read())
    assert sent_body["message"] == "does chicken and rice fit my plan?"
    snapshot = json.loads(sent_body["nutrition_plan_snapshot"])
    assert snapshot == {"run_id": "run-abc123", "success": True, "error": None}


@respx.mock
def test_coach_chat_forwards_unavailable_sentinel_when_nutrition_service_unreachable():
    user = create_user(username="chatuser3", password="supersecret1")
    set_last_nutrition_run_id(user["id"], "run-abc123")

    respx.get(f"{NUTRITION_API_URL}/api/v1/nutrition/result/run-abc123").mock(
        return_value=Response(500, json={"detail": "boom"})
    )
    route = respx.post(f"{WORKOUT_API_URL}/coach/chat").mock(
        return_value=Response(200, json={"response": "I don't have your nutrition plan right now."})
    )

    client = _client()
    r = client.post(
        "/api/coach/chat",
        json={"message": "does this fit my macros?"},
        headers=_auth_header_for(user["id"]),
    )

    assert r.status_code == 200
    sent_body = json.loads(route.calls.last.request.read())
    assert sent_body["nutrition_plan_snapshot"] == "(nutrition plan temporarily unavailable)"


def test_coach_chat_rejects_missing_bff_token():
    client = _client()
    r = client.post("/api/coach/chat", json={"message": "hello"})
    assert r.status_code in (401, 403)
