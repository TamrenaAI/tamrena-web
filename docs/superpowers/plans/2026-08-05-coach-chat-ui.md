# Coach Chat UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal chat page to the tamreena-web React frontend so a signed-in user can type questions to the coach agent and see replies, including their real past conversation on reopening the page.

**Architecture:** Tamrena-Workout gains a `GET /coach/history` read endpoint reusing the exact same last-20-message query the agent already uses for its own context. tamreena-web proxies it at `GET /api/coach/history` (same auth pattern as the existing `/api/coach/chat` proxy). The frontend gets one new page that loads history on mount and appends new turns via the existing `POST /api/coach/chat`.

**Tech Stack:** FastAPI (both backend repos), MongoDB (pymongo/mongomock), React 18 + TypeScript + Vite + react-router-dom (frontend, no test framework present).

## Global Constraints

- Spec: `tamreena-web/docs/superpowers/specs/2026-08-05-coach-chat-ui-design.md`. Refer back to it for rationale.
- History size: exactly 20 most-recent messages, oldest first — the same limit and query the agent's own context already uses (`_HISTORY_LIMIT` in `services/coach_assistant.py`). Never show more than the agent itself currently "remembers."
- No pagination, no message editing/deletion, no multiple conversation threads — single flat history per user, matching the existing backend model.
- No new frontend test framework — this repo has zero `*.test.tsx` files. Frontend verification is `npm run build` (type-check + build) plus manual testing against the running dev server and Docker backend.
- Response shape for both new endpoints: `{"messages": [{"role": "user" | "assistant", "content": "string"}, ...]}`.

---

## Task 1: Tamrena-Workout — `GET /coach/history`

**Files:**
- Modify: `Tamrena-Workout/services/coach_assistant.py` (rename `_load_recent_messages` → `load_recent_messages`, make it public since a second caller now needs it)
- Modify: `Tamrena-Workout/api/routes/coach.py` (add the new route + two new Pydantic models)
- Test: `Tamrena-Workout/tests/test_coach_route.py` (append new tests)

**Interfaces:**
- Consumes: `services.coach_assistant.load_recent_messages(user_id: str) -> list[dict]` (renamed from `_load_recent_messages` in this task — each dict has `"role"` and `"content"` keys, oldest first, capped at 20).
- Produces: `GET /coach/history` → `{"messages": [{"role": str, "content": str}, ...]}`, auth required (`get_current_user`), consumed by Task 2's proxy.

- [ ] **Step 1: Rename `_load_recent_messages` to `load_recent_messages`**

In `Tamrena-Workout/services/coach_assistant.py`, this function currently reads:

```python
def _load_recent_messages(user_id: str) -> list[dict]:
    """Oldest-first, capped at the most recent _HISTORY_LIMIT turns --
    sorts descending to get the N most recent Mongo documents, then
    reverses back to chronological order for the agent's messages list."""
    docs = list(
        get_db()
        .coach_messages.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(_HISTORY_LIMIT)
    )
    # Sort by created_at ascending to restore chronological order
    docs.sort(key=lambda d: d["created_at"])
    return [{"role": d["role"], "content": d["content"]} for d in docs]
```

Rename the function to `load_recent_messages` (drop the leading underscore — it's no longer
module-private now that `api/routes/coach.py` needs it too). Update its one call site in the
same file, inside `process_coach_message`:

```python
    history = _load_recent_messages(user_id)
```

becomes:

```python
    history = load_recent_messages(user_id)
```

Also update the module's `__all__` line near the top of the file, currently:

```python
__all__ = ["process_coach_message", "get_db"]
```

to:

```python
__all__ = ["process_coach_message", "get_db", "load_recent_messages"]
```

- [ ] **Step 2: Run the existing tests to confirm the rename didn't break anything**

Run: `pytest tests/test_coach_service.py -v` (from `Tamrena-Workout/`)
Expected: PASS (all 4 tests — the rename is a pure refactor, no behavior change, and nothing
outside this file referenced the old private name).

- [ ] **Step 3: Write the failing tests for the new route**

Append to `Tamrena-Workout/tests/test_coach_route.py` (it already has an autouse `override_auth`
fixture setting the authenticated user's id to `"test-user-id"` — reuse it):

```python
def test_coach_history_requires_authentication():
    app.dependency_overrides.pop(get_current_user, None)
    resp = client.get("/coach/history")
    assert resp.status_code in (401, 403)


def test_coach_history_returns_empty_list_for_new_user():
    resp = client.get("/coach/history")
    assert resp.status_code == 200
    assert resp.json() == {"messages": []}


def test_coach_history_returns_stored_messages_in_order():
    from datetime import datetime, timedelta, timezone
    from services.coach_assistant import get_db

    now = datetime.now(timezone.utc)
    get_db().coach_messages.insert_many([
        {"user_id": "test-user-id", "role": "user", "content": "first question", "created_at": now},
        {"user_id": "test-user-id", "role": "assistant", "content": "first reply", "created_at": now + timedelta(seconds=1)},
    ])

    resp = client.get("/coach/history")
    assert resp.status_code == 200
    assert resp.json() == {
        "messages": [
            {"role": "user", "content": "first question"},
            {"role": "assistant", "content": "first reply"},
        ]
    }


def test_coach_history_is_scoped_to_the_authenticated_user():
    from datetime import datetime, timezone
    from services.coach_assistant import get_db

    get_db().coach_messages.insert_one(
        {"user_id": "someone-else", "role": "user", "content": "not yours", "created_at": datetime.now(timezone.utc)}
    )

    resp = client.get("/coach/history")
    assert resp.status_code == 200
    assert resp.json() == {"messages": []}
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pytest tests/test_coach_route.py -v`
Expected: the 4 new tests FAIL with `404 Not Found` (`GET /coach/history` doesn't exist yet) —
the existing tests in this file still PASS.

- [ ] **Step 5: Implement the route**

In `Tamrena-Workout/api/routes/coach.py`, change the import line:

```python
from services.coach_assistant import process_coach_message
```

to:

```python
from services.coach_assistant import load_recent_messages, process_coach_message
```

Add two new Pydantic models after `CoachChatResponse`, and the new route after `coach_chat`:

```python
class CoachMessage(BaseModel):
    role: str
    content: str


class CoachHistoryResponse(BaseModel):
    messages: list[CoachMessage]


@router.get("/history", response_model=CoachHistoryResponse)
async def coach_history(user: dict = Depends(get_current_user)):
    messages = load_recent_messages(user["id"])
    return CoachHistoryResponse(messages=[CoachMessage(**m) for m in messages])
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pytest tests/test_coach_route.py -v`
Expected: PASS (8 passed — 4 existing + 4 new).

- [ ] **Step 7: Run the full test suite**

Run: `pytest -v` (from `Tamrena-Workout/`)
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add services/coach_assistant.py api/routes/coach.py tests/test_coach_route.py
git commit -m "feat: add GET /coach/history endpoint"
```

---

## Task 2: tamreena-web — `GET /api/coach/history` proxy

**Files:**
- Modify: `tamreena-web/backend/app/coach/routes.py` (add the new proxy route)
- Test: `tamreena-web/backend/tests/test_coach_routes.py` (append new tests)

**Interfaces:**
- Consumes: Task 1's `GET /coach/history` on Tamrena-Workout (`{"messages": [...]}`); existing
  `app.auth.dependencies.get_verified_token`, `app.tamreena_client.call_upstream`/`proxy_json`
  (all already imported in this file).
- Produces: `GET /api/coach/history` → passthrough of Tamrena-Workout's response, consumed by
  Task 3's frontend `getCoachHistory()`.

- [ ] **Step 1: Write the failing tests**

Append to `tamreena-web/backend/tests/test_coach_routes.py`:

```python
@respx.mock
def test_coach_history_forwards_token_and_returns_upstream_messages():
    user = create_user(username="historyuser1", password="supersecret1")
    route = respx.get(f"{WORKOUT_API_URL}/coach/history").mock(
        return_value=Response(200, json={"messages": [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]})
    )

    client = _client()
    r = client.get("/api/coach/history", headers=_auth_header_for(user["id"]))

    assert r.status_code == 200
    assert r.json() == {"messages": [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]}
    assert "Authorization" in route.calls.last.request.headers


def test_coach_history_rejects_missing_bff_token():
    client = _client()
    r = client.get("/api/coach/history")
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_coach_routes.py -v` (from `tamreena-web/backend/`)
Expected: `test_coach_history_forwards_token_and_returns_upstream_messages` FAILS with `404`
(route doesn't exist yet); `test_coach_history_rejects_missing_bff_token` may already pass
trivially (a 404 also isn't 200) — that's fine, it'll be exercised meaningfully once the route
exists.

- [ ] **Step 3: Implement the route**

In `tamreena-web/backend/app/coach/routes.py`, add after the existing `coach_chat` route (no new
imports needed — `Depends`, `call_upstream`, `proxy_json`, `get_verified_token` are all already
imported in this file):

```python
@router.get("/history")
async def coach_history(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/coach/history", token=token)
    return proxy_json(resp)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_coach_routes.py -v`
Expected: PASS (6 passed — 4 existing + 2 new).

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v` (from `tamreena-web/backend/`)
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add app/coach/routes.py tests/test_coach_routes.py
git commit -m "feat: add BFF coach history proxy"
```

---

## Task 3: Frontend — coach chat page

**Files:**
- Modify: `tamreena-web/frontend/src/lib/api.ts` (add `CoachMessage` type + two functions)
- Create: `tamreena-web/frontend/src/pages/coach/CoachChat.tsx`
- Modify: `tamreena-web/frontend/src/App.tsx` (register the `/coach` route)
- Modify: `tamreena-web/frontend/src/components/shell/Sidebar.tsx` (add nav entry)

**Interfaces:**
- Consumes: `GET /api/coach/history` (Task 2), `POST /api/coach/chat` (already exists), the
  existing `authFetch`/`parseErrorMessage` helpers in `api.ts`.
- Produces: `getCoachHistory(): Promise<CoachMessage[]>`, `sendCoachMessage(message: string): Promise<string>`,
  and `CoachMessage` (`{role: 'user' | 'assistant', content: string}`) — used only within this
  task's own `CoachChat.tsx`.

- [ ] **Step 1: Add the API client functions**

In `tamreena-web/frontend/src/lib/api.ts`, add this new section at the end of the file (after
the existing `// ── Live Session Report ...` section):

```typescript
// ── Coach Chat (proxied to Tamreena_AI via this BFF) ────────────────────

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getCoachHistory(): Promise<CoachMessage[]> {
  const res = await authFetch('/api/coach/history');
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load chat history (${res.status})`));
  const body = await res.json();
  return body.messages;
}

export async function sendCoachMessage(message: string): Promise<string> {
  const res = await authFetch('/api/coach/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to send message (${res.status})`));
  const body = await res.json();
  return body.response;
}
```

- [ ] **Step 2: Create the chat page**

Create `tamreena-web/frontend/src/pages/coach/CoachChat.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { getCoachHistory, sendCoachMessage, type CoachMessage } from '../../lib/api';

interface DisplayMessage extends CoachMessage {
  id: string;
  error?: string;
}

function CoachChat() {
  const [messages, setMessages] = useState<DisplayMessage[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCoachHistory()
      .then((history) => setMessages(history.map((m, i) => ({ ...m, id: `history-${i}` }))))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load chat history'));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMessageId = `local-${Date.now()}`;
    setMessages((prev) => [...(prev ?? []), { id: userMessageId, role: 'user', content: text }]);
    setDraft('');
    setSending(true);

    try {
      const reply = await sendCoachMessage(text);
      setMessages((prev) => [...(prev ?? []), { id: `${userMessageId}-reply`, role: 'assistant', content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setMessages((prev) =>
        (prev ?? []).map((m) => (m.id === userMessageId ? { ...m, error: message } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af' }}>
        ⚠️ {loadError}
      </div>
    );
  }

  if (messages === undefined) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading your conversation...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', maxWidth: '760px', margin: '0 auto' }}>
      <div
        ref={scrollRef}
        className="glass-panel"
        style={{ flex: 1, overflowY: 'auto', padding: '24px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
            Ask me about your workout or nutrition plan.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '14px',
                fontSize: '14px',
                lineHeight: 1.5,
                background: m.role === 'user' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                border: m.role === 'user' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
              }}
            >
              {m.content}
              {m.error && (
                <p style={{ color: '#fda4af', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>⚠️ {m.error}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '14px',
              }}
            >
              thinking…
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about your workout or nutrition plan..."
          disabled={sending}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#f8fafc',
            fontSize: '14px',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="btn btn-primary"
          style={{ padding: '12px 24px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default CoachChat;
```

- [ ] **Step 3: Register the route**

In `tamreena-web/frontend/src/App.tsx`, add the import alongside the other page imports:

```typescript
import CoachChat from './pages/coach/CoachChat';
```

Add the route inside the `<Route element={<ProtectedLayout />}>` block, after the `/exercises/detail`
route (order doesn't matter functionally, but keep it grouped with the other top-level tabs):

```tsx
            <Route path="/coach" element={<CoachChat />} />
```

- [ ] **Step 4: Add the sidebar nav entry**

In `tamreena-web/frontend/src/components/shell/Sidebar.tsx`, add a new entry to the `NAV_ITEMS`
array, after the existing `/exercises` entry:

```tsx
  {
    to: '/coach',
    label: 'AI Coach Chat',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
    ),
  },
```

- [ ] **Step 5: Type-check and build**

Run: `npm run build` (from `tamreena-web/frontend/`)
Expected: succeeds with zero TypeScript errors and produces a `dist/` build. This is the only
automated verification available in this repo (no test framework) — it catches type mismatches
(e.g. a typo'd import, a wrong prop name) but not runtime/behavioral bugs, so Step 6 covers those.

- [ ] **Step 6: Manual verification against the running stack**

This repo has no frontend test framework, so this step is the real functional check — do not
skip it. Prerequisites: Tamrena-Workout's `/coach/chat` and `/coach/history` (Task 1) working
(e.g. via the Docker containers, or `uvicorn api.main:app --port 8001` locally with Mongo
running), tamreena-web's backend running (`uvicorn app.main:app --port 8010` or its Docker
container) with `WORKOUT_API_URL` pointing at it, and a valid LLM API key configured in
Tamrena-Workout's `.env` (a real reply requires this — an expired/exhausted key still proves the
UI and both new endpoints work, just not a real chat reply).

1. Run `npm run dev` (from `tamreena-web/frontend/`), open the printed local URL.
2. Sign in (or sign up) via `/signin`.
3. Click "AI Coach Chat" in the sidebar — confirm it navigates to `/coach`.
4. First visit, no prior messages: confirm the "Ask me about your workout or nutrition plan."
   placeholder shows (not a blank screen, not a loading spinner stuck forever).
5. Type a message and press Enter (or click Send): confirm it appears immediately on the right
   (optimistic append), the input clears, the Send button disables, and a "thinking…" bubble
   appears on the left.
6. Once the backend responds: confirm the "thinking…" bubble is replaced by the actual assistant
   reply on the left, and the Send button re-enables.
7. Reload the page (`F5`): confirm both messages from step 5/6 reappear (this is the whole point
   of Task 1/2 — history persisted and reloaded, not just client-side state).
8. Stop Tamrena-Workout's API process (or otherwise make `/coach/chat` fail) and send another
   message: confirm the user's message stays visible with a small inline "⚠️ ..." error under it,
   rather than the page crashing or the message silently vanishing.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/coach/CoachChat.tsx frontend/src/App.tsx frontend/src/components/shell/Sidebar.tsx
git commit -m "feat: add coach chat page"
```

---

## Final check

- [ ] Run `pytest -v` in both `Tamrena-Workout/` and `tamreena-web/backend/` one more time — both
  suites fully green.
- [ ] Run `npm run build` in `tamreena-web/frontend/` one more time — succeeds with zero errors.
- [ ] Re-read the spec's "Behavior" section against the final `CoachChat.tsx` — confirm nothing
  drifted during implementation (loading state, empty state, optimistic send, error handling,
  401-redirect-via-`authFetch` all present).
