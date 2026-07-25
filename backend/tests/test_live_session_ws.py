"""
Tests for app/live_session/routes.py's WebSocket proxy
(live_session_proxy). Monkeypatches the outbound `websockets.connect`
call so these tests never require a live Computer-Vision instance.
"""

import asyncio
import json

import pytest

from app.auth import tokens
from app.live_session import routes


class _FakeUpstreamConnection:
    """Simulates Computer-Vision's real WS connection: yields a canned
    sequence of messages, then (if the canned sequence is exhausted)
    waits for the proxy to call .send() before ending — mirroring how the
    real upstream keeps streaming until told to stop, and letting tests
    assert that a stop command was actually relayed before the connection
    closes."""

    def __init__(self, canned_messages, sent_log):
        self._canned = canned_messages
        self.sent = sent_log
        self._stop_event = asyncio.Event()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def send(self, data):
        self.sent.append(data)
        self._stop_event.set()

    def __aiter__(self):
        return self._generate()

    async def _generate(self):
        for message in self._canned:
            yield message
        await self._stop_event.wait()


@pytest.fixture(autouse=True)
def _isolated_secret(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def _client():
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def _token() -> str:
    return tokens.create_access_token(user_id="507f1f77bcf86cd799439011")


def test_live_session_proxy_relays_state_event_and_binary_frame(monkeypatch):
    sent = []
    canned = [json.dumps({"type": "state", "reps": 1, "good": 1, "bad": 0}), b"fake-jpeg-bytes"]
    monkeypatch.setattr(routes.websockets, "connect", lambda uri: _FakeUpstreamConnection(canned, sent))

    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&video=abc123&token={_token()}") as ws:
        state_message = ws.receive_json()
        assert state_message["type"] == "state"
        assert state_message["reps"] == 1

        frame = ws.receive_bytes()
        assert frame == b"fake-jpeg-bytes"


def test_live_session_proxy_relays_end_event(monkeypatch):
    sent = []
    canned = [json.dumps({"type": "end", "reps": 3, "good": 2, "bad": 1})]
    monkeypatch.setattr(routes.websockets, "connect", lambda uri: _FakeUpstreamConnection(canned, sent))

    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&video=abc123&token={_token()}") as ws:
        end_message = ws.receive_json()
        assert end_message["type"] == "end"
        assert end_message["reps"] == 3


def test_live_session_proxy_forwards_stop_command_upstream(monkeypatch):
    sent = []
    monkeypatch.setattr(routes.websockets, "connect", lambda uri: _FakeUpstreamConnection([], sent))

    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&video=abc123&token={_token()}") as ws:
        ws.send_json({"action": "stop"})

    assert sent == [json.dumps({"action": "stop"})]


def test_live_session_proxy_rejects_invalid_token():
    client = _client()
    with client.websocket_connect("/ws/live-session?exercise=biceps_curl&video=abc123&token=not-a-real-token") as ws:
        message = ws.receive_json()
        assert message["type"] == "error"
