"""
Live Session routes: proxies real video-upload and pose-tracking traffic
to Computer-Vision (already-integrated coworker service, see Stage 5),
and persists final tallies to this service's own workout_live_sessions
DynamoDB table (Computer-Vision has no endpoint of its own to store a
session's result). The WebSocket live-tracking proxy is added onto this
same router in a later change — see live_session_proxy below.
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel

from app.auth.dependencies import get_verified_token
from app.config import CV_API_URL
from app.db import get_live_sessions_table
from app.tamreena_client import call_upstream, proxy_json

router = APIRouter(prefix="/api/live-session")


@router.post("/upload")
async def upload_live_session_video(file: UploadFile = File(...), token: str = Depends(get_verified_token)):
    file_bytes = await file.read()
    files = {"file": (file.filename, file_bytes, file.content_type)}
    resp = await call_upstream("POST", "/api/uploads", token=None, base_url=CV_API_URL, files=files)
    return proxy_json(resp)


class LiveSessionResultRequest(BaseModel):
    exercise_id: str
    exercise_name: str
    reps: int
    good: int
    bad: int


@router.post("/result")
async def save_live_session_result(body: LiveSessionResultRequest, token: str = Depends(get_verified_token)):
    session_id = secrets.token_hex(12)
    item = {
        "session_id": session_id,
        "exercise_id": body.exercise_id,
        "exercise_name": body.exercise_name,
        "reps": body.reps,
        "good": body.good,
        "bad": body.bad,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    get_live_sessions_table().put_item(Item=item)
    return item
