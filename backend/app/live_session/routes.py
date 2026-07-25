"""
Live Session routes: proxies real video-upload and pose-tracking traffic
to Computer-Vision (already-integrated coworker service, see Stage 5),
and persists final tallies to this service's own workout_live_sessions
DynamoDB table (Computer-Vision has no endpoint of its own to store a
session's result). The WebSocket live-tracking proxy is added onto this
same router in a later change — see live_session_proxy below.
"""

import asyncio
import json
import secrets
from datetime import datetime, timezone
from urllib.parse import quote

import websockets
from fastapi import APIRouter, Depends, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.routing import APIWebSocketRoute
from pydantic import BaseModel

from app.auth.dependencies import get_verified_token
from app.auth.tokens import InvalidSessionToken, decode_access_token
from app.config import CV_API_URL
from app.db import get_live_sessions_table
from app.tamreena_client import call_upstream, proxy_json

router = APIRouter(prefix="/api/live-session")


@router.post("/upload")
async def upload_live_session_video(file: UploadFile = File(...), token: str = Depends(get_verified_token)):
    file_bytes = await file.read()
    files = {"file": (file.filename or "upload.mp4", file_bytes, file.content_type)}
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


_CV_WS_URL = CV_API_URL.replace("http://", "ws://").replace("https://", "wss://")


async def live_session_proxy(websocket: WebSocket, exercise: str, video: str, token: str):
    """
    Proxies to Computer-Vision's real /ws/live?exercise=&source=video&video=
    upload:<id> endpoint, relaying binary JPEG frames and JSON state/end/
    error events downstream, and the browser's {"action":"stop"} command
    upstream. token is a query param (not a header) because the browser's
    native WebSocket API cannot set custom headers on the handshake — same
    constraint already solved for the SSE stream in app/workout/routes.py.

    Registered directly (not via @router.websocket) and appended to
    router.routes below: router carries prefix="/api/live-session" (set in
    Task 2 for the HTTP routes above), and APIRouter.websocket() always
    builds the final path as `self.prefix + path` with no per-route
    opt-out. Going through the decorator here would register this at
    /api/live-session/ws/live-session instead of the documented
    /ws/live-session. Constructing the APIWebSocketRoute directly and
    appending it to the same router's .routes list keeps this on the one
    router object main.py already includes (no main.py change needed)
    while landing on the correct, unprefixed path.
    """
    await websocket.accept()

    try:
        decode_access_token(token)
    except InvalidSessionToken:
        await websocket.send_json({"type": "error", "message": "Invalid or expired session."})
        await websocket.close()
        return

    upstream_url = f"{_CV_WS_URL}/ws/live?exercise={quote(exercise, safe='')}&source=video&video=upload:{quote(video, safe='')}"

    async with websockets.connect(upstream_url) as upstream:

        async def forward_upstream_to_client() -> None:
            async for message in upstream:
                if isinstance(message, (bytes, bytearray)):
                    await websocket.send_bytes(message)
                else:
                    await websocket.send_text(message)

        async def forward_client_to_upstream() -> None:
            try:
                while True:
                    message = await websocket.receive_json()
                    await upstream.send(json.dumps(message))
            except WebSocketDisconnect:
                pass

        forward1 = asyncio.create_task(forward_upstream_to_client())
        forward2 = asyncio.create_task(forward_client_to_upstream())
        try:
            await asyncio.wait({forward1, forward2}, return_when=asyncio.FIRST_COMPLETED)
        finally:
            forward1.cancel()
            forward2.cancel()
            try:
                await websocket.close()
            except RuntimeError:
                pass


router.routes.append(
    APIWebSocketRoute("/ws/live-session", endpoint=live_session_proxy, name="live_session_proxy")
)
