"""
This service's own session tokens (JWT), issued after a Google ID token
has been verified. JWT_SECRET MUST match Tamreena_AI's own JWT_SECRET —
tokens minted here are accepted by that repo's API using this same secret.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET


class InvalidSessionToken(Exception):
    pass


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise InvalidSessionToken(str(exc)) from exc

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise InvalidSessionToken("Token has no subject.")
    return user_id
