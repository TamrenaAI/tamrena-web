"""
Shared HTTP-proxy helpers for forwarding requests to Tamreena_AI's API
(WORKOUT_API_URL), the Computer-Vision service's API (CV_API_URL), and the
AWS Nutrition Agent (NUTRITION_API_URL).
"""

from typing import Optional
import httpx
from fastapi.responses import JSONResponse

from app.config import WORKOUT_API_URL

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
) -> Optional[httpx.Response]:
    """Make a request to an upstream service. Returns None if host is unreachable (dev/offline fallback)."""
    headers = auth_header(token) if token is not None else {}
    try:
        async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
            return await client.request(method, path, headers=headers, **kwargs)
    except httpx.HTTPError:
        return None


def proxy_json(response: Optional[httpx.Response]) -> JSONResponse:
    if response is None:
        return JSONResponse(status_code=502, content={"detail": "Upstream service unavailable"})
    try:
        content = response.json()
    except ValueError:
        content = {"detail": response.text}
    return JSONResponse(status_code=response.status_code, content=content)
