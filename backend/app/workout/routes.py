"""
Proxy routes forwarding to Tamreena_AI's plan-generation API
(WORKOUT_API_URL). The browser only ever calls this BFF — every one of
these routes forwards the caller's own Bearer token to Tamreena_AI, which
verifies it independently against the shared JWT_SECRET (see
app/auth/dependencies.py's get_verified_token). No separate
service-to-service credential is minted.
"""

import json
from contextlib import AsyncExitStack
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.auth.dependencies import get_verified_token, get_verified_token_for_stream
from app.config import WORKOUT_API_URL

router = APIRouter(prefix="/api/workout")

# Multi-step LLM agent calls (feedback adjustment, plan generation) can
# comfortably exceed the default timeout; give them extra room upstream.
LLM_TIMEOUT = 180.0


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _call_upstream(method: str, path: str, *, token: str, timeout: float = 30.0, **kwargs) -> httpx.Response:
    """Make a request to Tamreena_AI, translating connection failures into a
    clean 502 instead of letting them propagate as an unhandled 500."""
    try:
        async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=timeout) as client:
            return await client.request(method, path, headers=_headers(token), **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Workout service unavailable: {exc}") from exc


def _proxy_json(response: httpx.Response) -> JSONResponse:
    try:
        content = response.json()
    except ValueError:
        content = {"detail": response.text}
    return JSONResponse(status_code=response.status_code, content=content)


@router.get("/sessions")
async def list_sessions(token: str = Depends(get_verified_token)):
    resp = await _call_upstream("GET", "/sessions", token=token)
    return _proxy_json(resp)


@router.get("/sessions/{session_id}/plan")
async def get_session_plan(session_id: str, token: str = Depends(get_verified_token)):
    resp = await _call_upstream("GET", f"/sessions/{session_id}/plan", token=token)
    return _proxy_json(resp)


@router.post("/feedback/{session_id}")
async def submit_feedback(session_id: str, request: Request, token: str = Depends(get_verified_token)):
    body = await request.json()
    resp = await _call_upstream(
        "POST", f"/workouts/{session_id}/feedback", token=token, timeout=LLM_TIMEOUT, json=body
    )
    return _proxy_json(resp)


@router.post("/validate-image")
async def validate_image(file: UploadFile = File(...), token: str = Depends(get_verified_token)):
    file_bytes = await file.read()
    files = {"file": (file.filename, file_bytes, file.content_type)}
    resp = await _call_upstream("POST", "/validate-image", token=token, timeout=60.0, files=files)
    return _proxy_json(resp)


@router.post("/generate-plan")
async def generate_plan(
    inbody_file: UploadFile = File(...),
    goal: str = Form(...),
    days_per_week: int = Form(...),
    experience: str = Form(...),
    session_duration: str = Form(...),
    injuries: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    age: Optional[int] = Form(None),
    sleep_quality: Optional[str] = Form(None),
    job_type: Optional[str] = Form(None),
    current_program: Optional[str] = Form(None),
    token: str = Depends(get_verified_token),
):
    file_bytes = await inbody_file.read()
    files = {"inbody_file": (inbody_file.filename, file_bytes, inbody_file.content_type)}
    data = {
        "goal": goal,
        "days_per_week": str(days_per_week),
        "experience": experience,
        "session_duration": session_duration,
    }
    optional_fields = {
        "injuries": injuries,
        "priority": priority,
        "age": age,
        "sleep_quality": sleep_quality,
        "job_type": job_type,
        "current_program": current_program,
    }
    for key, value in optional_fields.items():
        if value is not None:
            data[key] = str(value)

    resp = await _call_upstream(
        "POST", "/generate-plan", token=token, timeout=LLM_TIMEOUT, files=files, data=data
    )
    return _proxy_json(resp)


@router.get("/generate-plan/stream/{session_id}")
async def stream_plan(session_id: str, token: str = Depends(get_verified_token_for_stream)):
    # Managed manually (not `async with`) because a 200 response needs the
    # stream kept open across this function's return, for the generator
    # below to consume as the StreamingResponse is read by the ASGI server.
    stack = AsyncExitStack()
    try:
        client = await stack.enter_async_context(httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=None))
        upstream = await stack.enter_async_context(
            client.stream(
                "GET",
                f"/generate-plan/stream/{session_id}",
                headers=_headers(token),
            )
        )
    except httpx.HTTPError as exc:
        await stack.aclose()
        raise HTTPException(502, f"Workout service unavailable: {exc}") from exc

    if upstream.status_code != 200:
        error_body = await upstream.aread()
        await stack.aclose()
        try:
            content = json.loads(error_body)
        except ValueError:
            content = {"detail": error_body.decode(errors="replace")}
        return JSONResponse(status_code=upstream.status_code, content=content)

    async def event_generator():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await stack.aclose()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
