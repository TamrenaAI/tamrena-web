# Coach Chat UI — Design

**Date:** 2026-08-05
**Status:** Approved, ready for implementation planning
**Repos touched:** `tamreena-web` (primary — proxy endpoint + frontend page), `Tamrena-Workout` (new read endpoint).

## Problem

The coach chatbot backend (`POST /coach/chat` in Tamrena-Workout, proxied by
`POST /api/coach/chat` in tamreena-web) was built with no UI — the only way to use it
today is `curl`/Postman. Add a minimal chat page to the existing tamreena-web React
frontend so a signed-in user can type questions and see replies, including their real
past conversation history on reopening the page.

## Key gap this design closes

Tamrena-Workout already persists every chat turn to MongoDB (`coach_messages`, see the
2026-08-05 coach chatbot feature), but exposes no way to read it back — only
`POST /coach/chat` (send a message, get one reply) exists. This design adds the read
side.

## Backend additions

### Tamrena-Workout: `GET /coach/history`

New route in `api/routes/coach.py`, behind the same `Depends(get_current_user)` auth as
`/coach/chat`. Returns the same last-20 messages `services/coach_assistant.py`'s
`_load_recent_messages(user_id)` already computes for the agent's own context — reused
directly, not reimplemented, so the UI can never show more than the agent itself
currently "remembers" for that user. Response shape:

```json
{ "messages": [ { "role": "user" | "assistant", "content": "string" }, ... ] }
```

Oldest first, matching `_load_recent_messages`'s existing order. Empty list (not an
error) for a user who has never chatted before.

### tamreena-web: `GET /api/coach/history`

New proxy route in `app/coach/routes.py`, alongside the existing `/api/coach/chat`
proxy. Behind `Depends(get_verified_token)`, forwarding the caller's bearer token
upstream — same auth pattern as every other proxy route in this file and its siblings
(`app/workout/routes.py`, `app/nutrition/routes.py`). Pure passthrough of Tamrena-Workout's
response — no request body, no nutrition-snapshot lookup (that's only relevant to
sending a new message, not reading history).

## Frontend additions (tamreena-web/frontend)

- **`src/pages/coach/CoachChat.tsx`** — new page, route `/coach`, registered inside
  `ProtectedLayout`'s routes in `App.tsx` (same as `/workout`, `/progress`, etc.).
- **`src/components/shell/Sidebar.tsx`** — new nav entry ("AI Coach Chat"), same
  `NAV_ITEMS` array pattern as the existing five entries, own icon.
- **`src/lib/api.ts`** — two new functions:
  - `getCoachHistory(): Promise<CoachMessage[]>` → `GET /api/coach/history`
  - `sendCoachMessage(message: string): Promise<string>` → `POST /api/coach/chat`,
    returns the `response` string.
  Both use the existing `authFetch` helper and `parseErrorMessage` for error bodies,
  same as every other function in this file.

### Behavior

- On mount: call `getCoachHistory()`, show a loading state while in flight, then
  populate the message list. An empty result shows a placeholder empty state ("Ask me
  about your workout or nutrition plan").
- Layout: scrollable message list (user messages right-aligned, assistant
  left-aligned) above a fixed text input + send button, styled with the existing
  dark `glass-panel` inline-style convention already used in `NutritionResults.tsx`
  and other pages — no new component library or CSS approach introduced.
- On send: optimistically append the user's message to the list immediately, disable
  the send button, show a "thinking…" indicator, call `sendCoachMessage`, append the
  reply (or an inline error state on that message, not a full-page crash) when it
  resolves, re-enable the send button.
- 401 from either new endpoint is already handled globally by `authFetch` (clears the
  token, redirects to `/signin`) — no new handling needed.

## Out of scope

- No pagination/infinite scroll — a flat last-20 list is the whole history surface,
  matching the agent's own context window.
- No message editing/deletion, no multiple conversation threads (matches the backend's
  existing single-continuous-thread-per-user model).
- No new automated frontend test suite — this repo currently has zero `*.test.tsx`
  files anywhere; introducing a test framework is out of scope for a minimal chat page.
  Verified manually against the running dev server + Docker backend instead.

## Testing

- **Tamrena-Workout:** a route test for `GET /coach/history` (empty history, populated
  history via seeded `coach_messages` docs, auth required) — following the same
  `TestClient` + `dependency_overrides` pattern as the existing `tests/test_coach_route.py`.
- **tamreena-web:** a proxy route test for `GET /api/coach/history` (forwards token,
  passthrough response, auth required) — following the same `respx`-mocking pattern as
  `tests/test_coach_routes.py`.
- **Frontend:** manual verification only (see Out of scope).
