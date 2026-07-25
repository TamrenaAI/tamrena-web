"""
Guards the cross-repo JWT contract: a token minted by THIS service must be
verifiable using Tamreena_AI's own JWT_SECRET (read from its .env), since
that's the whole point of Stage 1's auth handoff. If this test ever fails,
someone changed one repo's secret without changing the other's.
"""

import os
import secrets
from pathlib import Path

import jwt
import pytest

from app import config
from app.auth import tokens

TAMREENA_AI_ENV = Path(__file__).resolve().parents[3] / "Tamreena_AI" / ".env"


def _read_tamreena_ai_jwt_secret() -> str | None:
    if not TAMREENA_AI_ENV.exists():
        return None
    for line in TAMREENA_AI_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("JWT_SECRET="):
            return line.split("=", 1)[1].strip()
    return None


@pytest.mark.skipif(
    _read_tamreena_ai_jwt_secret() is None,
    reason="Tamreena_AI/.env not found at the expected sibling path — skip in environments without that repo checked out",
)
def test_configured_secret_matches_tamreena_ai():
    """
    The actual configured JWT_SECRET (as loaded from THIS repo's .env into
    app.config at import time, with zero monkeypatching) must be byte-for-byte
    identical to Tamreena_AI's own .env JWT_SECRET. This is the real guard —
    it fails the moment someone changes one repo's secret without the other's.
    """
    tamreena_ai_secret = _read_tamreena_ai_jwt_secret()
    assert config.JWT_SECRET == tamreena_ai_secret, (
        "This repo's configured JWT_SECRET does not match Tamreena_AI's — "
        "tokens minted here will be rejected by that repo's API. "
        "Set the exact same value in both .env files."
    )


@pytest.mark.skipif(
    _read_tamreena_ai_jwt_secret() is None,
    reason="Tamreena_AI/.env not found at the expected sibling path — skip in environments without that repo checked out",
)
def test_token_minted_with_configured_secret_is_verifiable_by_tamreena_ai():
    """
    End-to-end proof, using the real configured secret (no monkeypatch):
    mint a token the normal way, then independently decode it exactly like
    Tamreena_AI/auth/tokens.py does, using Tamreena_AI's own secret read
    fresh from its .env.

    The user_id here MUST match the real shape app.auth.models.create_user
    generates (24 hex chars via secrets.token_hex(12)), not an arbitrary
    string — Tamreena_AI's own auth/dependencies.py additionally parses the
    `sub` claim as bson.ObjectId(sub) and 401s if that fails. A prior
    version of this test used a UUID4 user_id, which passed this test (a
    bare truthiness check) while the equivalent real-world case was
    actually broken — Tamreena_AI rejected every request. This test would
    not have caught that regression; the ObjectId-shape assertion below
    closes that gap.
    """
    tamreena_ai_secret = _read_tamreena_ai_jwt_secret()
    user_id = secrets.token_hex(12)
    token = tokens.create_access_token(user_id=user_id)

    payload = jwt.decode(token, tamreena_ai_secret, algorithms=["HS256"])
    assert payload["sub"] == user_id
    # Structurally valid MongoDB ObjectId input: exactly 24 hex characters.
    # Tamreena_AI's auth/dependencies.py calls bson.ObjectId(sub) on this
    # claim and 401s if it isn't — this is what a UUID4 sub would fail.
    assert len(payload["sub"]) == 24
    int(payload["sub"], 16)  # raises ValueError if not valid hex
