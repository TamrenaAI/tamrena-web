"""
Proxy routes forwarding to Tamreena_AI's plan-generation API
(WORKOUT_API_URL). The browser only ever calls this BFF — every one of
these routes forwards the caller's own Bearer token to Tamreena_AI, which
verifies it independently against the shared JWT_SECRET (see
app/auth/dependencies.py's get_verified_token). No separate
service-to-service credential is minted.
"""

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.auth.dependencies import get_verified_token, get_verified_token_for_stream
from app.config import WORKOUT_API_URL

router = APIRouter(prefix="/api/workout")


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _proxy_json(response: httpx.Response) -> JSONResponse:
    return JSONResponse(status_code=response.status_code, content=response.json())


@router.get("/sessions")
async def list_sessions(token: str = Depends(get_verified_token)):
    async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=30.0) as client:
        resp = await client.get("/sessions", headers=_headers(token))
    return _proxy_json(resp)


@router.get("/sessions/{session_id}/plan")
async def get_session_plan(session_id: str, token: str = Depends(get_verified_token)):
    async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=30.0) as client:
        resp = await client.get(f"/sessions/{session_id}/plan", headers=_headers(token))
    return _proxy_json(resp)


@router.post("/feedback/{session_id}")
async def submit_feedback(session_id: str, request: Request, token: str = Depends(get_verified_token)):
    body = await request.json()
    async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=60.0) as client:
        resp = await client.post(f"/workouts/{session_id}/feedback", json=body, headers=_headers(token))
    return _proxy_json(resp)


@router.post("/validate-image")
async def validate_image(file: UploadFile = File(...), token: str = Depends(get_verified_token)):
    file_bytes = await file.read()
    files = {"file": (file.filename, file_bytes, file.content_type)}
    async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=60.0) as client:
        resp = await client.post("/validate-image", files=files, headers=_headers(token))
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

    async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=60.0) as client:
        resp = await client.post("/generate-plan", files=files, data=data, headers=_headers(token))
    return _proxy_json(resp)


@router.get("/generate-plan/stream/{session_id}")
async def stream_plan(session_id: str, token: str = Depends(get_verified_token_for_stream)):
    async def event_generator():
        async with httpx.AsyncClient(base_url=WORKOUT_API_URL, timeout=None) as client:
            async with client.stream(
                "GET",
                f"/generate-plan/stream/{session_id}",
                params={"token": token},
            ) as upstream:
                async for chunk in upstream.aiter_raw():
                    yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
