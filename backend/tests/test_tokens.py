"""
Tests for app/auth/tokens.py — JWT issuance/verification. JWT_SECRET is
monkeypatched rather than read from .env, so this doesn't depend on a
developer's local secret being configured.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from bson import ObjectId

from app.auth import tokens
from app.auth.tokens import InvalidSessionToken


@pytest.fixture(autouse=True)
def _fixed_secret(monkeypatch):
    monkeypatch.setattr(tokens, "JWT_SECRET", "test-secret-do-not-use-in-real-envs")


def test_round_trip_returns_same_user_id():
    user_id = str(ObjectId())
    token = tokens.create_access_token(user_id=user_id)
    assert tokens.decode_access_token(token) == user_id


def test_tampered_token_is_rejected():
    token = tokens.create_access_token(user_id=str(ObjectId()))
    mid = len(token) // 2
    tampered = token[:mid] + ("A" if token[mid] != "A" else "B") + token[mid + 1:]
    with pytest.raises(InvalidSessionToken):
        tokens.decode_access_token(tampered)


def test_expired_token_is_rejected():
    now = datetime.now(timezone.utc)
    expired_payload = {"sub": "not-checked-here", "iat": now - timedelta(days=2), "exp": now - timedelta(days=1)}
    expired_token = jwt.encode(expired_payload, tokens.JWT_SECRET, algorithm=tokens.JWT_ALGORITHM)
    with pytest.raises(InvalidSessionToken):
        tokens.decode_access_token(expired_token)
