# Live Camera Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open their browser camera on the Live Session screen and get real-time CV pose tracking while they exercise (mirroring today's upload-a-video flow), plus a richer post-session summary (accuracy %, per-bad-rep mistakes) for both flows.

**Architecture:** CV's `/ws/live` gains a `source=browser` mode where `LiveSession` reads frames from an inbound queue (fed by binary websocket messages) instead of opening a local `cv2.VideoCapture` device — the rest of the pose/rep/render/export pipeline is reused unchanged. The tamreena-web BFF's websocket proxy is extended to relay binary frames both directions (today it's JSON-only client→upstream) and gains a new mode that skips the upload step. The frontend adds a camera-capture UI that streams canvas-drawn frames over the open websocket, and pulls CV's already-existing session report (`GET /api/sessions/{id}`) for the accuracy/mistakes breakdown.

**Tech Stack:** FastAPI + Starlette WebSockets + OpenCV/numpy (Computer-Vision repo, Python); FastAPI + `websockets` client lib (tamreena-web backend, Python); React + native `WebSocket`/`MediaDevices`/`Canvas` APIs (tamreena-web frontend, TypeScript); pytest + respx (backend tests); Playwright (e2e).

## Global Constraints

- Two repos are touched: `E:\vs codes\Computer-Vision` (CV service) and `E:\vs codes\tamreena-web` (this repo, BFF + frontend). Commit separately in each repo's own history — do not mix changes into one commit across repos.
- Do not modify the existing `webcam` (local device) or `video` (uploaded file) source code paths in either repo — only add the new `browser` path alongside them.
- No new dependencies: CV already has `numpy`/`opencv-python`; tamreena-web backend already has `websockets`/`respx`; the frontend has no unit-test framework today (verify via `tsc -b` / `npm run build` + the existing Playwright e2e suite, per repo convention — do not introduce Jest/Vitest).
- Follow existing code style exactly: CV's docstring-heavy module headers, tamreena-web's proxy-route patterns (`call_upstream`/`proxy_json`), the frontend's existing inline-style React components (no CSS-in-JS library, no new UI kit).
- Every websocket/query-param change must stay backward compatible: omitting `source` must behave exactly as it does today in both repos.

---

## Part A — Computer-Vision repo (`E:\vs codes\Computer-Vision`)

### Task A1: `LiveSession` reads frames from a browser frame queue

**Files:**
- Modify: `backend/src/server/live_runner.py`
- Test: `backend/tests/test_live_runner_browser_source.py` (new)

**Interfaces:**
- Consumes: nothing new (uses existing `GymEngine`, `PoseService`, `open_capture`, `registry`).
- Produces: `LiveSession.__init__(exercise, source, events, video_path=None, frame_queue=None)` — `frame_queue: Optional[queue.Queue]` is a new keyword-only-by-convention param; when `source == "browser"`, `run()` reads JPEG bytes from it (via blocking `get(timeout=0.5)`) and `cv2.imdecode`s them instead of calling `open_capture()`/`cap.read()`. Task A2 (routes/live.py) constructs this queue and feeds it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_live_runner_browser_source.py`:

```python
"""Tests for LiveSession's browser (network-pushed-frame) source.

Covers only the new frame-source wiring (queue instead of cv2 capture) —
pose detection is stubbed out (see _NoLandmarksPoseService) because
verifying rep-counting/validation is already covered elsewhere; this test's
job is to prove browser mode never touches open_capture and does read/
process/republish frames pushed onto frame_queue, and that stop() ends the
thread cleanly.
"""

import os
import queue
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/ root
os.environ.setdefault("MODEL_PATH", "assets/models/pose_landmarker_lite.task")

# Importing src.server.live_runner transitively imports PoseService's module,
# which imports mediapipe. PoseService itself is monkeypatched out below, so
# stub mediapipe exactly like tests/test_hack_squat.py does.
_mp = types.ModuleType("mediapipe")
_mp_tasks = types.ModuleType("mediapipe.tasks")
_mp_python = types.ModuleType("mediapipe.tasks.python")
_mp_python.vision = types.ModuleType("mediapipe.tasks.python.vision")
_mp.tasks = _mp_tasks
_mp_tasks.python = _mp_python
sys.modules.update({
    "mediapipe": _mp, "mediapipe.tasks": _mp_tasks,
    "mediapipe.tasks.python": _mp_python,
    "mediapipe.tasks.python.vision": _mp_python.vision,
})

import cv2
import numpy as np

from src.server import live_runner
from src.server.live_runner import LiveSession


class _NoLandmarksPoseService:
    """Stand-in for PoseService: never detects a pose, so GymEngine's
    analyze/render path is never exercised by this test."""

    def __init__(self, *args, **kwargs):
        pass

    def detect(self, frame, timestamp):
        return None


def _jpeg_bytes(width=64, height=48) -> bytes:
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", frame)
    assert ok
    return buf.tobytes()


def test_browser_source_reads_frames_from_queue_not_a_capture(monkeypatch):
    monkeypatch.setattr(live_runner, "PoseService", _NoLandmarksPoseService)

    def _fail_open_capture(**kwargs):
        raise AssertionError("open_capture must not be called for source='browser'")

    monkeypatch.setattr(live_runner, "open_capture", _fail_open_capture)

    events: "queue.Queue" = queue.Queue(maxsize=120)
    frames_in: "queue.Queue" = queue.Queue(maxsize=8)
    session = LiveSession("biceps_curl", "browser", events, frame_queue=frames_in)

    session.start()
    for _ in range(3):
        frames_in.put(_jpeg_bytes())
    session.stop()
    session.join(timeout=10)
    assert not session.is_alive()

    published = []
    while not events.empty():
        published.append(events.get_nowait())

    frame_events = [e for e in published if isinstance(e, (bytes, bytearray))]
    end_events = [e for e in published if isinstance(e, dict) and e.get("type") == "end"]
    assert len(frame_events) >= 1
    assert len(end_events) == 1
    assert end_events[0]["reps"] == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_live_runner_browser_source.py -v`
Expected: FAIL — `TypeError: __init__() got an unexpected keyword argument 'frame_queue'`.

- [ ] **Step 3: Implement browser-mode frame source in `live_runner.py`**

At the top of the file, add the `numpy` import next to the existing `cv2` import (line 19):

```python
import cv2
import numpy as np
```

Change `LiveSession.__init__` (currently lines 49-55):

```python
    def __init__(
        self,
        exercise: str,
        source: str,
        events: "queue.Queue",
        video_path: Optional[str] = None,
        frame_queue: Optional["queue.Queue"] = None,
    ) -> None:
        super().__init__(daemon=True)
        self.exercise_key = exercise
        self.source = source
        self.video_path = video_path
        self.events = events
        self.frame_queue = frame_queue
        self._stop = threading.Event()
```

Also update the class docstring's `Args:` block (currently lines 41-47) to add:

```
        frame_queue: Inbound-frame queue for source="browser" — the WS
                     handler pushes JPEG bytes here as they arrive from the
                     client; unused for "webcam"/"video".
```

In `run()`, replace the capture-open block (currently lines 132-141):

```python
        cap = None
        if self.source != "browser":
            try:
                cap = open_capture(
                    video_path=self.video_path
                    or (str(settings.VIDEO_PATH) if settings.VIDEO_PATH else None),
                    use_webcam=self.source == "webcam",
                    webcam_index=settings.WEBCAM_INDEX,
                )
            except VideoSourceError as exc:
                self._publish({"type": "error", "message": str(exc)})
                return
```

Guard the rendered-output writer block (currently starts `if settings.SAVE_OUTPUT:` at line 152) so it's skipped for browser mode, since there's no `cap` to read width/height from before the first frame arrives:

```python
        if settings.SAVE_OUTPUT and cap is not None:
```

Keep the rest of that block's body (currently lines 153-166 — everything inside the `if settings.SAVE_OUTPUT:` block) exactly as-is, just re-indented under this new condition.

Replace the main loop's frame-read step (currently lines 185-188):

```python
        while not self._stop.is_set():
            if self.source == "browser":
                try:
                    data = self.frame_queue.get(timeout=0.5)
                except queue.Empty:
                    continue
                frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                if frame is None:
                    continue
            else:
                ok, frame = cap.read()
                if not ok:
                    break
```

Guard the capture-release at the end (currently line 217 `cap.release()`):

```python
        if cap is not None:
            cap.release()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_live_runner_browser_source.py -v`
Expected: PASS

- [ ] **Step 5: Run the full existing suite to confirm no regressions**

Run: `python -m pytest tests/ -v`
Expected: all pre-existing tests still PASS (this task didn't touch the `webcam`/`video` code paths).

- [ ] **Step 6: Commit**

```bash
cd "E:/vs codes/Computer-Vision"
git add backend/src/server/live_runner.py backend/tests/test_live_runner_browser_source.py
git commit -m "feat: add browser frame-queue source to LiveSession"
```

---

### Task A2: `/ws/live` accepts `source=browser` and relays binary frames

**Files:**
- Modify: `backend/src/server/routes/live.py`
- Test: `backend/tests/test_live_route_browser_source.py` (new)

**Interfaces:**
- Consumes: `LiveSession(exercise, source, events, video_path=None, frame_queue=None)` from Task A1.
- Produces: `/ws/live?exercise=<key>&source=webcam|video|browser[&video=<ref>]` — `browser` requires no `video` param; the client may now send binary websocket frames (pushed into the session's `frame_queue`) interleaved with the existing `{"action":"stop"}` text control message.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_live_route_browser_source.py`:

```python
"""Route-level tests for /ws/live's source='browser' handling.

Uses a fake LiveSession (captures constructor args, never runs the real
pipeline) so this test isolates the WebSocket route's handling of
source='browser' and binary-frame forwarding from LiveSession's own
frame-processing pipeline (covered by test_live_runner_browser_source.py).
"""

import json
import os
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/ root
os.environ.setdefault("MODEL_PATH", "assets/models/pose_landmarker_lite.task")

_mp = types.ModuleType("mediapipe")
_mp_tasks = types.ModuleType("mediapipe.tasks")
_mp_python = types.ModuleType("mediapipe.tasks.python")
_mp_python.vision = types.ModuleType("mediapipe.tasks.python.vision")
_mp.tasks = _mp_tasks
_mp_tasks.python = _mp_python
sys.modules.update({
    "mediapipe": _mp, "mediapipe.tasks": _mp_tasks,
    "mediapipe.tasks.python": _mp_python,
    "mediapipe.tasks.python.vision": _mp_python.vision,
})

from fastapi.testclient import TestClient

from src.server.app import app
from src.server.routes import live as live_routes


class _FakeLiveSession:
    instances = []

    def __init__(self, exercise, source, events, video_path=None, frame_queue=None):
        self.exercise = exercise
        self.source = source
        self.events = events
        self.video_path = video_path
        self.frame_queue = frame_queue
        self._alive = True
        _FakeLiveSession.instances.append(self)

    def start(self):
        pass

    def is_alive(self):
        return self._alive

    def stop(self):
        self._alive = False
        self.events.put({"type": "end", "reps": 0})


def test_browser_source_does_not_require_video(monkeypatch):
    _FakeLiveSession.instances.clear()
    monkeypatch.setattr(live_routes, "LiveSession", _FakeLiveSession)

    client = TestClient(app)
    with client.websocket_connect("/ws/live?exercise=biceps_curl&source=browser") as ws:
        end_event = ws.receive_json()
        assert end_event["type"] == "end"

    assert len(_FakeLiveSession.instances) == 1
    session = _FakeLiveSession.instances[0]
    assert session.source == "browser"
    assert session.video_path is None
    assert session.frame_queue is not None


def test_browser_source_forwards_binary_frames_to_frame_queue(monkeypatch):
    _FakeLiveSession.instances.clear()
    monkeypatch.setattr(live_routes, "LiveSession", _FakeLiveSession)

    client = TestClient(app)
    with client.websocket_connect("/ws/live?exercise=biceps_curl&source=browser") as ws:
        ws.send_bytes(b"fake-jpeg-bytes")
        ws.send_text(json.dumps({"action": "stop"}))
        end_event = ws.receive_json()
        assert end_event["type"] == "end"

    session = _FakeLiveSession.instances[0]
    assert session.frame_queue.get_nowait() == b"fake-jpeg-bytes"


def test_unknown_source_is_rejected(monkeypatch):
    _FakeLiveSession.instances.clear()
    monkeypatch.setattr(live_routes, "LiveSession", _FakeLiveSession)

    client = TestClient(app)
    with client.websocket_connect("/ws/live?exercise=biceps_curl&source=bogus") as ws:
        message = ws.receive_json()
        assert message["type"] == "error"
    assert _FakeLiveSession.instances == []
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m pytest tests/test_live_route_browser_source.py -v`
Expected: FAIL — `source must be 'webcam' or 'video'` error / `TypeError` on the extra `frame_queue` kwarg not being passed.

- [ ] **Step 3: Implement `source=browser` handling in `routes/live.py`**

Replace the whole file's websocket handler with:

```python
"""Live coaching stream — one WebSocket per workout.

Protocol
--------
Client connects to
``/ws/live?exercise=<key>&source=webcam|video|browser[&video=<ref>]``.

``video`` reference forms (only with ``source=video``):

* ``upload:<id>`` — a video previously uploaded via ``POST /api/uploads``
  (the **web app flow**; ids resolve strictly inside ``uploads/videos/``);
* an explicit path — developer escape hatch / CLI parity (local, single-user);
* omitted — falls back to ``VIDEO_PATH`` from ``.env``.

``source=browser`` streams frames pushed live from a remote client (e.g. a
browser's camera) instead of reading a local OpenCV capture: the client
sends one binary WebSocket message per JPEG frame, and this handler feeds
them into the session's inbound ``frame_queue``. ``video`` is unused for
this source.

Server → client::

    binary frame  — one JPEG per processed frame (~capture rate)
    {"type": "state", ...}  — metrics/feedback, ~15 Hz while active
    {"type": "end",  ...}   — workout finished; carries session_id of export
                              and rendered_video when rendering is enabled
    {"type": "error", ...}  — fatal problem (unknown exercise, no camera, ...)

Client → server::

    binary frame             — one JPEG (source="browser" only)
    {"action": "stop"}      — finish now (rep history so far is exported)

Only ONE live session may run at a time (a webcam is a single-user device);
a second connection is rejected with an error event and closed.
"""

import asyncio
import json
import queue
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...exercises.registry import registry
from ..live_runner import LiveSession
from .uploads import stored_path

router = APIRouter(tags=["live"])

# Single-slot gate. An asyncio.Lock would work too, but the boolean+guard
# lives entirely inside the handler's task — simple and race-free there.
_active_session: Optional[LiveSession] = None


def _push_frame(frame_queue: "queue.Queue", data: bytes) -> None:
    """Drop-oldest push: the runner only ever needs the latest frame, so a
    slow consumer never makes incoming camera frames back up."""
    try:
        frame_queue.put_nowait(data)
    except queue.Full:
        try:
            frame_queue.get_nowait()
        except queue.Empty:
            pass
        try:
            frame_queue.put_nowait(data)
        except queue.Full:
            pass


@router.websocket("/ws/live")
async def live_session(websocket: WebSocket, exercise: str, source: str = "webcam", video: Optional[str] = None):
    global _active_session
    await websocket.accept()

    if exercise not in registry.list():
        await websocket.send_json({"type": "error", "message": f"Unknown exercise '{exercise}'"})
        return await websocket.close()
    if source not in ("webcam", "video", "browser"):
        await websocket.send_json({"type": "error", "message": "source must be 'webcam', 'video' or 'browser'"})
        return await websocket.close()

    # Resolve upload references to real paths inside uploads/videos/.
    if video is not None and video.startswith("upload:"):
        upload_id = video[len("upload:"):]
        resolved = stored_path(upload_id)
        if resolved is None:
            await websocket.send_json({"type": "error", "message": f"Unknown upload '{upload_id}'"})
            return await websocket.close()
        video = str(resolved)

    if _active_session is not None and _active_session.is_alive():
        await websocket.send_json({"type": "error", "message": "Another live session is already running"})
        return await websocket.close()

    events: "queue.Queue" = queue.Queue(maxsize=120)
    frame_queue: Optional["queue.Queue"] = queue.Queue(maxsize=2) if source == "browser" else None
    session = LiveSession(exercise, source, events, video_path=video, frame_queue=frame_queue)
    _active_session = session
    session.start()

    async def forward_events() -> None:
        """Pump runner events to the socket without blocking the loop."""
        loop = asyncio.get_running_loop()
        while True:
            event = await loop.run_in_executor(None, events.get)
            if isinstance(event, (bytes, bytearray)):
                await websocket.send_bytes(bytes(event))
            else:
                await websocket.send_json(event)
                if event.get("type") in ("end", "error"):
                    return

    async def listen_commands() -> None:
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    session.stop()
                    return
                if message.get("bytes") is not None:
                    if frame_queue is not None:
                        _push_frame(frame_queue, message["bytes"])
                    continue
                if message.get("text") is not None:
                    payload = json.loads(message["text"])
                    if payload.get("action") == "stop":
                        session.stop()
        except WebSocketDisconnect:
            session.stop()

    forward = asyncio.create_task(forward_events())
    listen = asyncio.create_task(listen_commands())
    try:
        await asyncio.wait({forward, listen}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        session.stop()
        forward.cancel()
        listen.cancel()
        if _active_session is session:
            _active_session = None
        try:
            await websocket.close()
        except RuntimeError:
            pass  # already closed by the peer
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_live_route_browser_source.py -v`
Expected: PASS

- [ ] **Step 5: Run the full existing suite to confirm no regressions**

Run: `python -m pytest tests/ -v`
Expected: all pre-existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
cd "E:/vs codes/Computer-Vision"
git add backend/src/server/routes/live.py backend/tests/test_live_route_browser_source.py
git commit -m "feat: accept source=browser on /ws/live, relay binary frames"
```

---

## Part B — tamreena-web backend (`E:\vs codes\tamreena-web\backend`)

### Task B1: BFF proxy supports camera mode and relays binary frames

**Files:**
- Modify: `backend/app/live_session/routes.py`
- Test: `backend/tests/test_live_session_ws.py`

**Interfaces:**
- Consumes: CV's `/ws/live?exercise=&source=browser` (no `video`) from Task A2 — same host/port as today (`CV_API_URL`), no other CV contract change.
- Produces: `/ws/live-session?exercise=&token=&source=video|browser[&video=]` — `source` defaults to `"video"` (so existing callers omitting it keep working exactly as today).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_live_session_ws.py` (after the existing tests, same file — it already imports `json`, `pytest`, `tokens`, `routes`, and defines `_FakeUpstreamConnection`/`_client`/`_token`):

```python
def test_live_session_proxy_browser_source_omits_video_and_relays_binary_frames(monkeypatch):
    captured_uri = {}
    sent = []

    def _fake_connect(uri):
        captured_uri["uri"] = uri
        return _FakeUpstreamConnection([], sent)

    monkeypatch.setattr(routes.websockets, "connect", _fake_connect)

    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&source=browser&token={_token()}") as ws:
        ws.send_bytes(b"fake-jpeg-bytes")
        ws.send_json({"action": "stop"})

    assert "source=browser" in captured_uri["uri"]
    assert "video=" not in captured_uri["uri"]
    assert sent[0] == b"fake-jpeg-bytes"
    assert sent[1] == json.dumps({"action": "stop"})


def test_live_session_proxy_rejects_video_source_without_video_param():
    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&source=video&token={_token()}") as ws:
        message = ws.receive_json()
        assert message["type"] == "error"


def test_live_session_proxy_defaults_to_video_source_for_backward_compatibility(monkeypatch):
    captured_uri = {}

    def _fake_connect(uri):
        captured_uri["uri"] = uri
        return _FakeUpstreamConnection([], [])

    monkeypatch.setattr(routes.websockets, "connect", _fake_connect)

    client = _client()
    with client.websocket_connect(f"/ws/live-session?exercise=biceps_curl&video=abc123&token={_token()}"):
        pass

    assert "source=video&video=upload:abc123" in captured_uri["uri"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `python -m pytest tests/test_live_session_ws.py -v`
Expected: FAIL — `source=browser` currently 404s/errors on the proxy building `video=upload:None`, and the proxy has no `source` query param at all yet.

- [ ] **Step 3: Implement camera mode + binary relay in `live_session/routes.py`**

Replace the module's imports (currently lines 10-25) and the `live_session_proxy` function + trailing docstring (currently lines 62-124) with:

```python
import asyncio
import json
import secrets
from datetime import datetime, timezone
from typing import Optional
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
```

(only the added `from typing import Optional` line is new here; the rest of the top of the file — `router = APIRouter(...)`, `upload_live_session_video`, `LiveSessionResultRequest`, `save_live_session_result` — is unchanged.)

Replace the `_CV_WS_URL` line and everything below it (currently lines 62-129) with:

```python
_CV_WS_URL = CV_API_URL.replace("http://", "ws://").replace("https://", "wss://")


async def live_session_proxy(
    websocket: WebSocket,
    exercise: str,
    token: str,
    source: str = "video",
    video: Optional[str] = None,
):
    """
    Proxies to Computer-Vision's real /ws/live?exercise=&source=&video=
    endpoint, relaying binary JPEG frames and JSON state/end/error events
    downstream, and the browser's {"action":"stop"} command (plus, for
    source="browser", the browser's own live JPEG frames) upstream. token is
    a query param (not a header) because the browser's native WebSocket API
    cannot set custom headers on the handshake — same constraint already
    solved for the SSE stream in app/workout/routes.py.

    source="video" (default, backward compatible with every existing
    caller): analyzes a video previously uploaded via POST
    /api/live-session/upload; video is required and is the upload id.

    source="browser": no prior upload — the client (its camera, captured to
    canvas) pushes binary JPEG frames directly over this open socket for
    live analysis; video is unused.

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

    if source not in ("video", "browser"):
        await websocket.send_json({"type": "error", "message": "source must be 'video' or 'browser'."})
        await websocket.close()
        return

    if source == "video":
        if not video:
            await websocket.send_json({"type": "error", "message": "video is required when source='video'."})
            await websocket.close()
            return
        upstream_url = (
            f"{_CV_WS_URL}/ws/live?exercise={quote(exercise, safe='')}"
            f"&source=video&video=upload:{quote(video, safe='')}"
        )
    else:
        upstream_url = f"{_CV_WS_URL}/ws/live?exercise={quote(exercise, safe='')}&source=browser"

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
                    message = await websocket.receive()
                    if message["type"] == "websocket.disconnect":
                        return
                    if message.get("bytes") is not None:
                        await upstream.send(message["bytes"])
                    elif message.get("text") is not None:
                        await upstream.send(message["text"])
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_live_session_ws.py -v`
Expected: PASS (including the 4 pre-existing tests in that file — unchanged behavior for `source` omitted/`"video"`).

- [ ] **Step 5: Run the full backend suite to confirm no regressions**

Run: `python -m pytest tests/ -v`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add backend/app/live_session/routes.py backend/tests/test_live_session_ws.py
git commit -m "feat: add camera-mode source and binary frame relay to live-session proxy"
```

---

### Task B2: BFF proxies the CV session report

**Files:**
- Modify: `backend/app/live_session/routes.py`
- Test: `backend/tests/test_live_session_routes.py`

**Interfaces:**
- Consumes: CV's `GET /api/sessions/{session_id}` (already exists, unchanged — `backend/src/server/routes/sessions.py` in the CV repo).
- Produces: `GET /api/live-session/report/{session_id}` — requires the BFF bearer token (`get_verified_token`), returns the CV report JSON verbatim (proxied via `call_upstream`/`proxy_json`, same pattern as `/api/exercises/cv`).

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_live_session_routes.py` (it already imports `respx`, `Response`, `_client`, `_auth_header`, `CV_API_URL`):

```python
@respx.mock
def test_get_report_proxies_cv_session_report():
    respx.get(f"{CV_API_URL}/api/sessions/abc123").mock(
        return_value=Response(200, json={"summary": {"accuracy": 75.0, "total_reps": 4}})
    )
    client = _client()
    r = client.get("/api/live-session/report/abc123", headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["summary"]["accuracy"] == 75.0


def test_get_report_rejects_missing_bff_token():
    client = _client()
    r = client.get("/api/live-session/report/abc123")
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `backend/`): `python -m pytest tests/test_live_session_routes.py -v`
Expected: FAIL — `404 Not Found` (route doesn't exist yet).

- [ ] **Step 3: Add the report proxy route**

In `backend/app/live_session/routes.py`, add this route directly below `save_live_session_result` (i.e. right before the `_CV_WS_URL = ...` line):

```python
@router.get("/report/{session_id}")
async def get_live_session_report(session_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", f"/api/sessions/{session_id}", token=None, base_url=CV_API_URL)
    return proxy_json(resp)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_live_session_routes.py -v`
Expected: PASS

- [ ] **Step 5: Run the full backend suite to confirm no regressions**

Run: `python -m pytest tests/ -v`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add backend/app/live_session/routes.py backend/tests/test_live_session_routes.py
git commit -m "feat: proxy Computer-Vision's session report for live-session results"
```

---

## Part C — tamreena-web frontend (`E:\vs codes\tamreena-web\frontend`)

### Task C1: `lib/api.ts` — camera-mode websocket URL + report fetch

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/live-session/LiveSession.tsx` (only the one call site, to keep the build green)

**Interfaces:**
- Consumes: `GET /api/live-session/report/{session_id}` from Task B2; `/ws/live-session?...&source=` from Task B1.
- Produces: `type LiveSessionSource = { mode: 'video'; videoId: string } | { mode: 'camera' }`; `getLiveSessionWebSocketUrl(exerciseId: string, source: LiveSessionSource): string`; `getLiveSessionReport(sessionId: string): Promise<LiveSessionReport | null>`; `type LiveSessionReport` (`summary.accuracy`, `summary.most_common_error`, `history[]`, `rules[]`) — consumed by Task C3.

- [ ] **Step 1: Replace `getLiveSessionWebSocketUrl` and add report types/function**

In `frontend/src/lib/api.ts`, replace the existing `getLiveSessionWebSocketUrl` function (currently lines 391-395) with:

```ts
export type LiveSessionSource = { mode: 'video'; videoId: string } | { mode: 'camera' };

export function getLiveSessionWebSocketUrl(exerciseId: string, source: LiveSessionSource): string {
  const token = getToken();
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  const params = new URLSearchParams({ exercise: exerciseId, token: token ?? '' });
  if (source.mode === 'video') {
    params.set('source', 'video');
    params.set('video', source.videoId);
  } else {
    params.set('source', 'browser');
  }
  return `${wsBase}/ws/live-session?${params.toString()}`;
}

export interface LiveSessionRepEvaluation {
  rule: string;
  passed: boolean;
  measured_value: number | null;
}

export interface LiveSessionRepHistoryEntry {
  number: number;
  good: boolean;
  evaluations: LiveSessionRepEvaluation[];
}

export interface LiveSessionRuleInfo {
  name: string;
  message: string;
}

export interface LiveSessionReport {
  summary: {
    total_reps: number;
    good_reps: number;
    bad_reps: number;
    accuracy: number;
    most_common_error: string | null;
  };
  history: LiveSessionRepHistoryEntry[];
  rules: LiveSessionRuleInfo[];
}

export async function getLiveSessionReport(sessionId: string): Promise<LiveSessionReport | null> {
  const res = await authFetch(`/api/live-session/report/${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Fix the one existing call site so the app still builds**

In `frontend/src/pages/live-session/LiveSession.tsx`, change (currently line 77):

```ts
    const ws = new WebSocket(getLiveSessionWebSocketUrl(exercise.id, videoId));
```

to:

```ts
    const ws = new WebSocket(getLiveSessionWebSocketUrl(exercise.id, { mode: 'video', videoId }));
```

And update `startLiveSession`'s parameter type (currently line 76, `const startLiveSession = (videoId: string) => {`) to:

```ts
  const startLiveSession = (videoId: string) => {
```

(unchanged for this step — Task C2 will change this signature further when it adds camera mode; this task only needs the call site to compile against the new `getLiveSessionWebSocketUrl` signature.)

- [ ] **Step 3: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add frontend/src/lib/api.ts frontend/src/pages/live-session/LiveSession.tsx
git commit -m "feat: add camera-mode websocket URL and session-report fetch to api client"
```

---

### Task C2: Camera capture UI in `LiveSession.tsx`

**Files:**
- Modify: `frontend/src/pages/live-session/LiveSession.tsx`

**Interfaces:**
- Consumes: `getLiveSessionWebSocketUrl(exerciseId, source)` and `type LiveSessionSource` from Task C1.
- Produces: the 'upload' phase gets an input-mode toggle; camera mode opens the websocket directly (no upload) and streams canvas-captured frames while `phase === 'live'`. The 'live'/'complete'/'error' phases and `finishSession` signature are otherwise unchanged (Task C3 extends `finishSession` next).

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `frontend/src/pages/live-session/LiveSession.tsx` with:

```tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getLiveSessionWebSocketUrl,
  saveLiveSessionResult,
  uploadLiveSessionVideo,
  type CvExercise,
  type LiveSessionSource,
} from '../../lib/api';

interface LiveSessionLocationState {
  exercise: CvExercise;
}

interface LiveState {
  reps: number;
  good: number;
  bad: number;
  feedback: string[];
}

type Phase = 'upload' | 'live' | 'complete' | 'error';
type InputMode = 'file' | 'camera';

const INITIAL_LIVE_STATE: LiveState = { reps: 0, good: 0, bad: 0, feedback: [] };
const CAMERA_CAPTURE_INTERVAL_MS = 125; // ~8 fps

function LiveSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LiveSessionLocationState | null;

  const [phase, setPhase] = useState<Phase>('upload');
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<LiveState>(INITIAL_LIVE_STATE);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ reps: number; good: number; bad: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const liveStateRef = useRef<LiveState>(INITIAL_LIVE_STATE);
  const phaseRef = useRef<Phase>('upload');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopCamera = () => {
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
      stopCamera();
    };
  }, []);

  if (!state) {
    navigate('/exercises', { replace: true });
    return null;
  }

  const { exercise } = state;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
  };

  const requestCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not access the camera.');
      setCameraReady(false);
    }
  };

  const handleSelectMode = async (mode: InputMode) => {
    setError(null);
    if (mode === inputMode) return;
    if (inputMode === 'camera') stopCamera();
    setInputMode(mode);
    if (mode === 'camera') {
      await requestCamera();
    }
  };

  const startFrameCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    captureIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(blob);
          }
        },
        'image/jpeg',
        0.7,
      );
    }, CAMERA_CAPTURE_INTERVAL_MS);
  };

  const finishSession = async (reps: number, good: number, bad: number) => {
    try {
      await saveLiveSessionResult(exercise.id, exercise.name, reps, good, bad);
    } catch (err) {
      console.error('Failed to save live session result', err);
    }
    setResult({ reps, good, bad });
    setPhase('complete');
    stopCamera();
  };

  const startLiveSession = (source: LiveSessionSource) => {
    const ws = new WebSocket(getLiveSessionWebSocketUrl(exercise.id, source));
    wsRef.current = ws;
    ws.binaryType = 'blob';

    ws.onopen = () => {
      setUploading(false);
      setPhase('live');
      if (source.mode === 'camera') startFrameCapture();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          const next: LiveState = { reps: data.reps, good: data.good, bad: data.bad, feedback: data.feedback ?? [] };
          liveStateRef.current = next;
          setLiveState(next);
        } else if (data.type === 'end') {
          wsRef.current = null;
          ws.close();
          const current = liveStateRef.current;
          finishSession(data.reps ?? current.reps, current.good, current.bad);
        } else if (data.type === 'error') {
          wsRef.current = null;
          setError(data.message);
          setPhase('error');
          stopCamera();
          ws.close();
        }
      } else {
        const blobUrl = URL.createObjectURL(event.data as Blob);
        if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
        frameUrlRef.current = blobUrl;
        setFrameUrl(blobUrl);
      }
    };

    ws.onerror = () => {
      wsRef.current = null;
      setError('Lost connection during the live session.');
      setPhase('error');
      stopCamera();
    };

    ws.onclose = (event) => {
      wsRef.current = null;
      if (phaseRef.current === 'live' && !event.wasClean) {
        setError('Lost connection during the live session.');
        setPhase('error');
        stopCamera();
      }
    };
  };

  const handleStartAnalysis = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const upload = await uploadLiveSessionVideo(file);
      startLiveSession({ mode: 'video', videoId: upload.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      setUploading(false);
    }
  };

  const handleStartCameraAnalysis = () => {
    if (!cameraReady) return;
    setError(null);
    startLiveSession({ mode: 'camera' });
  };

  const handleEndSession = () => {
    wsRef.current?.send(JSON.stringify({ action: 'stop' }));
  };

  const handleRetry = () => {
    setError(null);
    setPhase('upload');
    setFile(null);
    setLiveState(INITIAL_LIVE_STATE);
    liveStateRef.current = INITIAL_LIVE_STATE;
    if (frameUrlRef.current) {
      URL.revokeObjectURL(frameUrlRef.current);
      frameUrlRef.current = null;
    }
    setFrameUrl(null);
    setResult(null);
    stopCamera();
    setInputMode('file');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-dark)',
        padding: '48px 24px',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: '580px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span className="badge badge-emerald" style={{ marginBottom: '10px' }}>CV Computer Vision HUD</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Live Session — {exercise.name}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Real-time pose tracking, rep counting & posture biomechanics
          </p>
        </div>

        {phase === 'upload' && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'inline-flex', gap: '4px', marginBottom: '24px' }}>
              <button
                type="button"
                id="live-session-mode-file-btn"
                onClick={() => handleSelectMode('file')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: inputMode === 'file' ? '#10b981' : 'transparent',
                  color: inputMode === 'file' ? '#042f2e' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                📄 Upload File
              </button>
              <button
                type="button"
                id="live-session-mode-camera-btn"
                onClick={() => handleSelectMode('camera')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: inputMode === 'camera' ? '#10b981' : 'transparent',
                  color: inputMode === 'camera' ? '#042f2e' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                📷 Record Camera
              </button>
            </div>

            {inputMode === 'file' && (
              <>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
                  📹
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
                  Select Video File for Form Analysis
                </h3>
                <p style={{ fontSize: '13.5px', color: '#94a3b8', marginBottom: '24px' }}>
                  Upload your execution video to launch real-time websocket AI telemetry.
                </p>

                <input id="live-session-file-input" type="file" accept="video/*" onChange={handleFileChange} className="form-input" style={{ marginBottom: '16px' }} />

                {error && <p style={{ color: '#fda4af', fontSize: '13px', marginBottom: '16px' }}>⚠️ {error}</p>}

                <button
                  id="live-session-start-btn"
                  onClick={handleStartAnalysis}
                  disabled={!file || uploading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                >
                  {uploading ? 'Analyzing Telemetry...' : 'Start CV Form Analysis'}
                </button>
              </>
            )}

            {inputMode === 'camera' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
                  Record Yourself for Live Form Analysis
                </h3>
                <p style={{ fontSize: '13.5px', color: '#94a3b8', marginBottom: '20px' }}>
                  Grant camera access, then start — the AI tracks your form live as you exercise.
                </p>

                <video
                  id="live-session-camera-preview"
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', borderRadius: '14px', marginBottom: '16px', backgroundColor: '#070a11', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {cameraError && <p style={{ color: '#fda4af', fontSize: '13px', marginBottom: '16px' }}>⚠️ {cameraError}</p>}
                {error && <p style={{ color: '#fda4af', fontSize: '13px', marginBottom: '16px' }}>⚠️ {error}</p>}

                {!cameraReady && (
                  <button
                    id="live-session-request-camera-btn"
                    onClick={requestCamera}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '14px', fontSize: '15px', marginBottom: '12px' }}
                  >
                    {cameraError ? 'Try Again' : 'Enable Camera'}
                  </button>
                )}

                <button
                  id="live-session-start-camera-btn"
                  onClick={handleStartCameraAnalysis}
                  disabled={!cameraReady}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                >
                  Start Live Analysis
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'live' && (
          <div className="glass-panel" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.9)' }}>
            {frameUrl ? (
              <img
                id="live-session-frame"
                src={frameUrl}
                alt="Live camera view"
                style={{ width: '100%', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: 'var(--shadow-emerald)' }}
              />
            ) : (
              <div style={{ width: '100%', height: '280px', background: '#070a11', borderRadius: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }} className="shimmer">
                Initializing AI Neural Stream...
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>TOTAL REPS</span>
                <p id="live-session-reps" className="metric-val" style={{ fontSize: '24px', color: '#f8fafc', margin: '2px 0 0 0' }}>{liveState.reps}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PERFECT FORM</span>
                <p id="live-session-good" className="metric-val" style={{ fontSize: '24px', color: '#34d399', margin: '2px 0 0 0' }}>{liveState.good}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', background: 'rgba(7, 10, 17, 0.7)' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>FORM BREAK</span>
                <p id="live-session-bad" className="metric-val" style={{ fontSize: '24px', color: '#f43f5e', margin: '2px 0 0 0' }}>{liveState.bad}</p>
              </div>
            </div>

            {liveState.feedback.length > 0 && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>LIVE BIOMECHANICS FEEDBACK</span>
                {liveState.feedback.map((message, i) => (
                  <p key={i} style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0 }}>✓ {message}</p>
                ))}
              </div>
            )}

            <button id="live-session-end-btn" onClick={handleEndSession} className="btn btn-secondary" style={{ width: '100%', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}>
              End Live Session
            </button>
          </div>
        )}

        {phase === 'complete' && result && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
              🎯
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '16px' }}>
              Session Analysis Complete
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>TOTAL REPS</span>
                <p id="live-session-final-reps" className="metric-val" style={{ fontSize: '22px', color: '#f8fafc', margin: '2px 0 0 0' }}>{result.reps}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>GOOD REPS</span>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#34d399', margin: '2px 0 0 0' }}>{result.good}</p>
              </div>
              <div className="glass-panel" style={{ padding: '12px', background: 'rgba(7, 10, 17, 0.6)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>BAD REPS</span>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#f43f5e', margin: '2px 0 0 0' }}>{result.bad}</p>
              </div>
            </div>

            <a href="/exercises" id="live-session-back-link" className="btn btn-primary" style={{ display: 'inline-flex' }}>
              Return to Exercise Directory →
            </a>
          </div>
        )}

        {phase === 'error' && (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <p style={{ color: '#fda4af', fontSize: '14px', marginBottom: '20px' }}>⚠️ {error}</p>
            <button id="live-session-retry-btn" onClick={handleRetry} className="btn btn-primary">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveSession;
```

- [ ] **Step 2: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Manual smoke test**

Run (from repo root): `docker compose up --build -d`, open `http://localhost:5174`, sign in, go to an exercise's Live Session screen, click "Record Camera", grant camera permission, confirm the preview shows, click "Start Live Analysis", confirm the `live` phase HUD appears (frames may show a black/annotated image depending on whether the CV service — with Task A1/A2 deployed — detects a pose), click "End Live Session", confirm it reaches "Session Analysis Complete".
Expected: no console errors; camera indicator light turns off after ending the session.

- [ ] **Step 4: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add frontend/src/pages/live-session/LiveSession.tsx
git commit -m "feat: add camera-recording mode to Live Session screen"
```

---

### Task C3: Show accuracy % and bad-rep mistakes on the complete screen

**Files:**
- Modify: `frontend/src/pages/live-session/LiveSession.tsx`

**Interfaces:**
- Consumes: `getLiveSessionReport(sessionId)` and `type LiveSessionReport` from Task C1.
- Produces: the 'complete' phase now shows accuracy %, most-common-error, and a per-bad-rep mistake list for both video-upload and camera sessions, whenever the CV `end` event carries a `session_id`.

- [ ] **Step 1: Add the `report` import and state**

In `frontend/src/pages/live-session/LiveSession.tsx`, change the import block (added in Task C2) to:

```tsx
import {
  getLiveSessionReport,
  getLiveSessionWebSocketUrl,
  saveLiveSessionResult,
  uploadLiveSessionVideo,
  type CvExercise,
  type LiveSessionReport,
  type LiveSessionSource,
} from '../../lib/api';
```

Add a `report` state next to `result` (currently `const [result, setResult] = useState<{ reps: number; good: number; bad: number } | null>(null);`):

```tsx
  const [result, setResult] = useState<{ reps: number; good: number; bad: number } | null>(null);
  const [report, setReport] = useState<LiveSessionReport | null>(null);
```

- [ ] **Step 2: Fetch the report when a session ends**

Replace `finishSession` with:

```tsx
  const finishSession = async (reps: number, good: number, bad: number, sessionId?: string) => {
    try {
      await saveLiveSessionResult(exercise.id, exercise.name, reps, good, bad);
    } catch (err) {
      console.error('Failed to save live session result', err);
    }
    let cvReport: LiveSessionReport | null = null;
    if (sessionId) {
      try {
        cvReport = await getLiveSessionReport(sessionId);
      } catch (err) {
        console.error('Failed to load session report', err);
      }
    }
    setResult({ reps, good, bad });
    setReport(cvReport);
    setPhase('complete');
    stopCamera();
  };
```

Update the `end` branch in `ws.onmessage` to pass `data.session_id` through:

```tsx
        } else if (data.type === 'end') {
          wsRef.current = null;
          ws.close();
          const current = liveStateRef.current;
          finishSession(data.reps ?? current.reps, current.good, current.bad, data.session_id);
        }
```

Reset `report` in `handleRetry` (add next to `setResult(null);`):

```tsx
    setResult(null);
    setReport(null);
```

- [ ] **Step 3: Render the report on the complete screen**

In the `phase === 'complete'` block, insert this JSX right after the closing `</div>` of the reps/good/bad grid and before the `<a href="/exercises" ...>` link:

```tsx
            {report && (
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '16px', background: 'rgba(7, 10, 17, 0.6)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: report.summary.most_common_error ? '8px' : 0 }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Accuracy</span>
                    <span id="live-session-accuracy" style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {report.summary.accuracy.toFixed(0)}%
                    </span>
                  </div>
                  {report.summary.most_common_error && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>Most Common Error</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fda4af' }}>
                        {report.rules.find((r) => r.name === report.summary.most_common_error)?.message ?? report.summary.most_common_error}
                      </span>
                    </div>
                  )}
                </div>

                {report.history.some((rep) => !rep.good) && (
                  <div id="live-session-mistakes" className="glass-panel" style={{ padding: '16px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#f43f5e', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Bad Rep Mistakes
                    </span>
                    {report.history
                      .filter((rep) => !rep.good)
                      .map((rep) => {
                        const messages = rep.evaluations
                          .filter((ev) => !ev.passed)
                          .map((ev) => report.rules.find((r) => r.name === ev.rule)?.message ?? ev.rule);
                        return (
                          <p key={rep.number} style={{ fontSize: '13px', color: '#cbd5e1', margin: '4px 0' }}>
                            Rep {rep.number}: {messages.join(', ') || 'form break'}
                          </p>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 4: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 5: Manual smoke test**

Repeat the upload-a-video E2E path manually (`docker compose up --build -d`, sign in, pick an exercise, upload `e2e/fixtures/test-clip.mp4`, let it finish) and confirm the complete screen now shows an "Accuracy" row (0% is fine — the fixture has no human figure) without errors, proving the report is fetched and rendered for the existing video flow too.

- [ ] **Step 6: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add frontend/src/pages/live-session/LiveSession.tsx
git commit -m "feat: show accuracy and bad-rep mistakes on the live session complete screen"
```

---

### Task C4: E2E coverage for the camera flow

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/live-session.spec.ts`

**Interfaces:**
- Consumes: `#live-session-mode-camera-btn`, `#live-session-request-camera-btn`, `#live-session-start-camera-btn`, `#live-session-end-btn` DOM ids from Task C2.

- [ ] **Step 1: Enable Playwright's fake camera device**

Replace `playwright.config.ts` with:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    permissions: ['camera'],
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
});
```

- [ ] **Step 2: Add the camera-flow e2e test**

Append to `e2e/live-session.spec.ts` (it already imports `test`/`expect` from `@playwright/test`):

```ts
test('live session: record with camera, receive a real end event, and see results', async ({ page }) => {
  test.setTimeout(60 * 1000);

  await page.goto('/');

  await page.locator('#toggle-mode-btn').click();
  const username = `e2elivecamera${Date.now()}`;
  await page.locator('#username-input').fill(username);
  await page.locator('#password-input').fill('supersecret1');
  await page.locator('#confirm-password-input').fill('supersecret1');
  await page.locator('#submit-btn').click();

  await expect(page.getByText('No training protocol yet')).toBeVisible();

  await page.getByRole('link', { name: 'Exercises' }).click();
  await page.locator('#exercises-mode-cv').click();

  const firstCard = page.locator('[id^="cv-exercise-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  const startBtn = page.locator('#start-live-session-btn');
  await expect(startBtn).toBeEnabled();
  await startBtn.click();

  await expect(page.getByText(/Live Session —/)).toBeVisible();
  await page.locator('#live-session-mode-camera-btn').click();
  await page.locator('#live-session-request-camera-btn').click();

  const startCameraBtn = page.locator('#live-session-start-camera-btn');
  await expect(startCameraBtn).toBeEnabled({ timeout: 10000 });
  await startCameraBtn.click();

  await expect(page.locator('#live-session-end-btn')).toBeVisible({ timeout: 10000 });
  await page.locator('#live-session-end-btn').click();

  await expect(page.getByText('Session Analysis Complete')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#live-session-final-reps')).toBeVisible();
});
```

- [ ] **Step 3: Run the e2e suite**

Requires the full stack running with both this repo's `docker compose up --build -d` AND the Computer-Vision service (with Tasks A1/A2 deployed) reachable at `CV_API_URL`. Run (from repo root): `npx playwright test e2e/live-session.spec.ts`
Expected: both the pre-existing upload test and the new camera test PASS.

- [ ] **Step 4: Commit**

```bash
cd "E:/vs codes/tamreena-web"
git add playwright.config.ts e2e/live-session.spec.ts
git commit -m "test: add e2e coverage for the camera live-session flow"
```

---

## Self-Review

**Spec coverage:**
- Browser camera opens, CV analyzes live while playing → Tasks A1, A2, C2. ✅
- Click stop → final reps/good/bad → Task C2 (`handleEndSession` reuses the existing `end` event path). ✅
- Percentage and bad-rep mistakes → Tasks B2, C1, C3, applied to both camera and upload flows. ✅
- Both repos touched, no destructive changes to existing `webcam`/`video` paths → Tasks A1/A2 explicitly guard with `if self.source != "browser"` / `source in (...)`. ✅
- Backward compatibility (existing callers omitting `source`) → covered by `test_live_session_proxy_defaults_to_video_source_for_backward_compatibility` (Task B1) and the untouched pre-existing tests in `test_live_session_ws.py`/`test_live_session_routes.py`. ✅
- Known single-active-session limitation → intentionally not addressed (per spec's explicit scope note); no task claims to fix it.

**Placeholder scan:** no TBD/TODO markers; every step has real, runnable code.

**Type consistency:** `LiveSessionSource` (Task C1) matches the `startLiveSession(source: LiveSessionSource)` signature used in Task C2; `LiveSessionReport`'s `summary.accuracy`/`most_common_error`/`history[].evaluations[].rule`/`rules[].name`/`message` fields (Task C1) are exactly the fields read in Task C3's JSX, and match the CV `SessionAnalyzer` export shape confirmed by reading `output/sessions/*.json` during design. `LiveSession.__init__`'s `frame_queue` param (Task A1) matches the constructor call in Task A2's route and the `_FakeLiveSession` test double's signature.
