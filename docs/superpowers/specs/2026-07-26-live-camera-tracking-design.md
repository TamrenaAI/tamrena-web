# Live Camera Tracking — Design

Date: 2026-07-26
Repos touched: `tamreena-web` (this repo) and `Computer-Vision` (sibling repo, path `E:\vs codes\Computer-Vision`).

## Goal

Today's Live Session screen (`frontend/src/pages/live-session/LiveSession.tsx`) only
supports analyzing a pre-recorded video: pick a file → upload → the
Computer-Vision (CV) service processes it and streams annotated frames + rep
state back over a websocket. This adds a second mode: the user opens their
camera in the browser, the CV service tracks the exercise **live** while
they're moving, and clicking Stop produces the same final tally (reps, good,
bad) plus a richer breakdown (accuracy %, which rule each bad rep failed).

## Why this needs a Computer-Vision change too

CV's `/ws/live` already accepts `source=webcam`, but
`backend/src/services/video_source.py`'s `open_capture(use_webcam=True)` calls
`cv2.VideoCapture(webcam_index)` — a **local OS device on the machine running
the CV server**. That's fine for a local single-machine demo, but useless for
a browser client whose camera is on a different machine. Supporting "record
yourself in the browser" for real requires CV to accept frames **pushed**
over the network instead of opening a local device.

## Data flow

1. User selects "Record Camera" on the Live Session upload screen → browser
   requests `getUserMedia({video: true})` and shows a live preview.
2. Clicking Start opens the existing `/ws/live-session` BFF proxy websocket in
   a new camera mode — **no prior `/upload` call**. The BFF builds the
   upstream URL as `.../ws/live?exercise=...&source=browser` (no `video=`
   param), instead of today's `source=video&video=upload:<id>`.
3. Once the socket is open, the frontend captures frames from the `<video>`
   element via a hidden `<canvas>` at ~8 fps and sends each as a binary JPEG
   blob over the open websocket (`ws.send(blob)`).
4. The BFF proxy relays those binary frames upstream unchanged. Today
   `forward_client_to_upstream` only handles `receive_json()` (the `{"action":
   "stop"}` command); it's extended to use `websocket.receive()` and forward
   raw bytes upstream too. The existing upstream→client relay (binary
   annotated frames + JSON `state`/`end`/`error`) is untouched.
5. CV's `/ws/live` gains `source=browser`: instead of `open_capture()`,
   `LiveSession` pulls decoded frames off a queue fed by the websocket
   handler's incoming binary messages. Pose detection, rep counting/
   validation, rendering, JPEG re-encoding, `state`/`end` events, and session
   export are all reused unchanged — only the frame *source* differs.
6. On the `end` event (carries `session_id`, exactly as today), the frontend
   calls a new BFF endpoint that proxies CV's existing
   `GET /api/sessions/{id}`, which already returns `summary.accuracy`,
   `summary.most_common_error`, and per-rep `history[].evaluations` (which
   rule each rep passed/failed). This is shown on the complete screen for
   **both** camera and upload-video sessions.

## Component changes

### Computer-Vision (`backend/src/server/routes/live.py`)
- Accept `source in ("webcam", "video", "browser")` (currently `"webcam"` or
  `"video"`).
- For `source == "browser"`: `video` stays unused/optional (no upload
  resolution needed).
- Create a `queue.Queue` for inbound frames and pass it to `LiveSession` only
  when `source == "browser"`.
- `listen_commands()`: switch from `websocket.receive_json()` to
  `websocket.receive()`, branching on message kind:
  - bytes → `frame_queue.put(...)` (browser mode only)
  - text → parse JSON, handle `{"action": "stop"}` as today

### Computer-Vision (`backend/src/server/live_runner.py`)
- `LiveSession.__init__` accepts an optional `frame_queue: Optional[queue.Queue]`.
- `run()`: when `self.source == "browser"`, skip `open_capture()`/`cap.read()`
  entirely; instead loop on `frame_queue.get()` (blocking, unblocked on stop
  via a sentinel) and `cv2.imdecode(np.frombuffer(data, np.uint8),
  cv2.IMREAD_COLOR)` to get the frame. Everything from `pose_service.detect(...)`
  onward (analyze, render, JPEG re-encode, publish, end/export) is identical
  to the existing loop body — no duplication of that logic.
- `"webcam"`/`"video"` code paths are untouched.

### tamreena-web BFF (`backend/app/live_session/routes.py`)
- `live_session_proxy` gains a `source: str = "video"` query param.
  - `source == "video"`: build the upstream URL exactly as today
    (`source=video&video=upload:<video>`), `video` required.
  - `source == "browser"`: build `.../ws/live?exercise=...&source=browser`,
    `video` not required/used.
- `forward_client_to_upstream`: switch from `receive_json()` to
  `websocket.receive()`; forward `bytes` messages upstream via
  `upstream.send(data)` (binary), and text messages as JSON control commands
  exactly as today.
- New route: `GET /api/live-session/report/{session_id}`, proxying to CV's
  `GET /api/sessions/{session_id}` via the existing `call_upstream`/
  `proxy_json` helpers (same pattern already used for `/api/exercises/cv` and
  `/api/live-session/upload`).

### tamreena-web frontend (`frontend/src/lib/api.ts`)
- `getLiveSessionWebSocketUrl` takes a mode instead of a bare `videoId`:
  `{ mode: 'video'; videoId: string } | { mode: 'camera' }`, appending
  `source=video&video=...` or `source=browser` accordingly.
- New `getLiveSessionReport(sessionId: string): Promise<LiveSessionReport>`
  calling `GET /api/live-session/report/{sessionId}`.
- New `LiveSessionReport` type covering the fields the UI needs:
  `summary.accuracy`, `summary.most_common_error`, `summary.total_reps`,
  `history[]` (`number`, `good`, `evaluations[]` with `rule`/`passed`), and
  `rules[]` (id → human-readable `message`, for turning a failed rule name
  into displayable text).

### tamreena-web frontend (`frontend/src/pages/live-session/LiveSession.tsx`)
- Upload phase gets a pill toggle "Upload File" / "Record Camera", matching
  the mode-switcher pattern already used in `CaptureScreen.tsx`.
- Camera mode:
  - On selecting it, request `getUserMedia({ video: true })`; show the live
    preview. Permission-denied/no-camera errors show inline on the picker
    (not the full-page error phase) with a retry action.
  - "Start Live Analysis" opens the websocket directly in camera mode (no
    `/upload` call). Once `ws.onopen` fires, start a capture loop
    (`setInterval` drawing the `<video>` frame to a hidden `<canvas>`,
    `canvas.toBlob(blob => ws.send(blob), 'image/jpeg', 0.7)`, ~8 fps).
  - The capture loop and camera `MediaStream` tracks are stopped whenever the
    session ends, errors, retries, or the component unmounts (mirroring the
    existing websocket cleanup in the `useEffect` teardown).
- `live` phase UI (annotated frame `<img>`, rep HUD, feedback list) is
  already source-agnostic — no changes needed there.
- `finishSession` additionally calls `getLiveSessionReport(sessionId)`
  best-effort (failure is logged and ignored, mirroring the existing
  `saveLiveSessionResult` error handling) and stores the result. The complete
  screen adds: Accuracy %, Most Common Error, and a per-bad-rep list (e.g.
  "Rep 2 — elbow drift") built from `history[]` + `rules[]`. This applies to
  **both** camera and upload-video sessions.

## Error handling
- Camera permission denied / no camera device → inline error on the
  upload/camera picker; user can retry `getUserMedia` without leaving the
  screen.
- Websocket-level errors (CV `{"type":"error"}`, unclean close) reuse the
  existing `error` phase; camera stream teardown happens there too.
- Report-fetch failure is non-fatal: the complete screen still shows
  reps/good/bad even if the richer report can't be fetched.

## Known limitation (explicitly out of scope)

CV's `/ws/live` allows only **one** active live session process-wide
(`_active_session` single-slot gate in `routes/live.py`, documented as "a
webcam is a single-user device"). This already limits today's upload-video
flow to one concurrent user across the whole CV deployment, and camera mode
inherits the same limit. Making sessions per-connection instead of global is
a larger, separate change and is not addressed here.

## Testing
- Computer-Vision:
  - Unit test for `LiveSession` browser-mode frame loop: feed a fake
    `frame_queue`, assert the engine processes frames and publishes
    `state`/`end` events, without requiring a real camera.
  - Route test for `/ws/live?source=browser`: connect, send binary frames,
    send `{"action":"stop"}`, assert `end` event received.
- tamreena-web backend:
  - Extend `backend/tests/test_live_session_ws.py` with a browser-mode proxy
    test asserting binary frames are relayed both directions.
  - New test for `GET /api/live-session/report/{session_id}` proxying to CV.
- tamreena-web e2e:
  - Extend `e2e/live-session.spec.ts` to cover the camera toggle, using
    Playwright's fake-camera device flag
    (`--use-fake-device-for-media-stream`) so it runs headlessly in CI.
