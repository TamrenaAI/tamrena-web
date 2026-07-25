"""
Shared HTTP-proxy helpers for forwarding requests to Tamreena_AI's API
(WORKOUT_API_URL). Used by every BFF proxy route module — the browser only
ever calls this BFF, and every proxy route forwards the caller's own Bearer
token to Tamreena_AI, which verifies it independently against the shared
JWT_SECRET (see app/auth/dependencies.py's get_verified_token). No separate
service-to-service credential is minted.
"""

import httpx
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.config import WORKOUT_API_URL

# Multi-step LLM agent calls (feedback adjustment, plan generation, monthly
# review) can comfortably exceed the default timeout; give them extra room
# upstream.
LLM_TIMEOUT = 180.0


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def call_upstream(method: str, path: str, *, token: str, timeout: float = 30.0, **kwargs) -> httpx.Response:
    """Make a request to Tamreena_AI, translating connection failures into a
    clean 502 instead of letting them propagate as an unhandled 500."""
    try:
        async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=timeout) as client:
            return await client.request(method, path, headers=auth_header(token), **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Workout service unavailable: {exc}") from exc


def proxy_json(response: httpx.Response) -> JSONResponse:
    try:
        content = response.json()
    except ValueError:
        content = {"detail": response.text}
    return JSONResponse(status_code=response.status_code, content=content)
