"""
Proxy routes forwarding to Tamreena_AI's plan-generation API
(WORKOUT_API_URL). See app/tamreena_client.py for the shared HTTP-proxy
helpers used by every BFF proxy route module.
"""

import json
from contextlib import AsyncExitStack
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.auth.dependencies import get_verified_token, get_verified_token_for_stream
from app.config import WORKOUT_API_URL
from app.tamreena_client import LLM_TIMEOUT, auth_header, call_upstream, proxy_json

router = APIRouter(prefix="/api/workout")


@router.get("/sessions")
async def list_sessions(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/sessions", token=token)
    return proxy_json(resp)


@router.get("/sessions/{session_id}/plan")
async def get_session_plan(session_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", f"/sessions/{session_id}/plan", token=token)
    return proxy_json(resp)


@router.post("/feedback/{session_id}")
async def submit_feedback(session_id: str, request: Request, token: str = Depends(get_verified_token)):
    body = await request.json()
    resp = await call_upstream(
        "POST", f"/workouts/{session_id}/feedback", token=token, timeout=LLM_TIMEOUT, json=body
    )
    return proxy_json(resp)


@router.post("/validate-image")
async def validate_image(file: UploadFile = File(...), token: str = Depends(get_verified_token)):
    file_bytes = await file.read()
    files = {"file": (file.filename, file_bytes, file.content_type)}
    resp = await call_upstream("POST", "/validate-image", token=token, timeout=60.0, files=files)
    return proxy_json(resp)


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

    resp = await call_upstream(
        "POST", "/generate-plan", token=token, timeout=LLM_TIMEOUT, files=files, data=data
    )
    return proxy_json(resp)


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
                headers=auth_header(token),
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
