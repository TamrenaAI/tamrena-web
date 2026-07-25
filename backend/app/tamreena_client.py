"""
Shared HTTP-proxy helpers for forwarding requests to Tamreena_AI's API
(WORKOUT_API_URL) and the Computer-Vision service's API (CV_API_URL). Used
by every BFF proxy route module — the browser only ever calls this BFF.
Workout/progress/exercise-catalogue routes backed by Tamreena_AI forward
the caller's own Bearer token, which Tamreena_AI verifies independently
against the shared JWT_SECRET (see app/auth/dependencies.py's
get_verified_token). The Computer-Vision service has no auth of its own,
so calls to it pass token=None and no Authorization header is attached —
the BFF route itself still requires the caller to be signed in, it just
doesn't forward that token upstream since CV doesn't check it. No separate
service-to-service credential is minted for either upstream.
"""

from typing import Optional

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


async def call_upstream(
    method: str,
    path: str,
    *,
    token: Optional[str] = None,
    base_url: str = WORKOUT_API_URL,
    timeout: float = 30.0,
    **kwargs,
) -> httpx.Response:
    """Make a request to an upstream service, translating connection
    failures into a clean 502 instead of letting them propagate as an
    unhandled 500. token=None means no Authorization header is attached —
    used for the Computer-Vision service, which has no auth of its own."""
    headers = auth_header(token) if token is not None else {}
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
            return await client.request(method, path, headers=headers, **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Upstream service unavailable: {exc}") from exc


def proxy_json(response: httpx.Response) -> JSONResponse:
    try:
        content = response.json()
    except ValueError:
        content = {"detail": response.text}
    return JSONResponse(status_code=response.status_code, content=content)
