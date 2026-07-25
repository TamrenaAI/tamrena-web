"""
FastAPI dependencies protecting routes behind a valid session token.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.models import get_user_by_id
from app.auth.tokens import InvalidSessionToken, decode_access_token

_bearer_scheme = HTTPBearer()
_optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)) -> dict:
    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidSessionToken as exc:
        raise HTTPException(401, f"Invalid or expired session: {exc}") from exc

    user = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(401, "User no longer exists.")
    return user


def get_verified_token(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)) -> str:
    """Verifies the bearer token's signature/expiry and returns the RAW token
    string (not the decoded user) — used by the workout proxy routes, which
    forward this same token to Tamreena_AI's API rather than needing this
    service's own user record."""
    try:
        decode_access_token(credentials.credentials)
    except InvalidSessionToken as exc:
        raise HTTPException(401, f"Invalid or expired session: {exc}") from exc
    return credentials.credentials


def get_verified_token_for_stream(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer_scheme),
) -> str:
    """Same check as get_verified_token, but also accepts the token as a
    `?token=` query param — the browser's native EventSource API cannot send
    an Authorization header, so this is the only way an SSE client can
    authenticate. Only used by the generate-plan stream proxy route."""
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        raise HTTPException(401, "Missing authentication token.")
    try:
        decode_access_token(raw_token)
    except InvalidSessionToken as exc:
        raise HTTPException(401, f"Invalid or expired session: {exc}") from exc
    return raw_token
