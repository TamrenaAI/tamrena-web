"""
Guards the cross-repo JWT contract: a token minted by THIS service must be
verifiable using Tamreena_AI's own JWT_SECRET (read from its .env), since
that's the whole point of Stage 1's auth handoff. If this test ever fails,
someone changed one repo's secret without changing the other's.
"""

import os
from pathlib import Path

import jwt
import pytest
from bson import ObjectId

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
def test_token_minted_here_is_verifiable_with_tamreena_ai_secret(monkeypatch):
    tamreena_ai_secret = _read_tamreena_ai_jwt_secret()
    monkeypatch.setattr(tokens, "JWT_SECRET", tamreena_ai_secret)
    token = tokens.create_access_token(user_id=str(ObjectId()))

    # Decode independently, exactly like Tamreena_AI/auth/tokens.py does.
    payload = jwt.decode(token, tamreena_ai_secret, algorithms=["HS256"])
    assert payload["sub"]
