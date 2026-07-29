# Real workout-plan table + CV live-session report — Design

Date: 2026-07-29
Repos touched: `tamreena-web` (this repo), `Tamrena-Workout` (sibling repo,
path `E:\vs codes\Tamrena-AI\Full-Project\Tamrena-Workout`). No changes
needed in `Computer-Vision` — its existing `/api/sessions/{id}` endpoint is
consumed as-is.

Related prior design: `2026-07-26-live-camera-tracking-design.md`. Its step
6 already planned "on the `end` event, fetch the full CV report and show it
on the complete screen" — that step was never implemented on the frontend.
Part 2 of this spec implements exactly that step, scoped down to score
chart + mistakes summary (not the full rep-by-rep breakdown that design's
wording implies is possible).

## Two unrelated problems, one spec

1. **The workout-plan table shown to users is fake.** `PlanView.tsx`
   renders a hardcoded `DEFAULT_DAYS` mock — verified live in the browser:
   the exact exercise names/sets/reps/RPE values it displays for a real,
   freshly-generated AI plan matched the mock constant verbatim. The real
   plan text is only visible in a collapsed "raw text" accordion. Any
   AI-driven exercise swap (via the feedback form) only patches this mock
   in local React state — gone on refresh.
2. **The CV live-session completion screen only shows rep counts.** The
   standalone Computer-Vision app already has a full report (score-per-rep
   line chart, rule-failure breakdown, coaching tips) for the exact same
   session data; tamreena-web's own `LiveSession.tsx` throws away the
   `session_id` the CV engine already sends and shows nothing but
   reps/good/bad.

Both are scoped into one spec at the user's request; they touch disjoint
files and can be implemented/reviewed independently.

---

## Part 1 — Workout plan table reflects the real plan

### Why this is safe to fix now

The backend already has everything needed except the "return it as JSON"
step:

- `Tamrena-Workout/pipeline/plan_finalize.py` already parses the weekly
  schedule's day headings (`### Day {N} — ...`) and
  `| # | Exercise | Sets × Reps | Rest | RPE |` tables reliably (used by
  `enforce_volume_budget`, has real-session regression fixtures in
  `tests/test_plan_finalize.py`).
- `Tamrena-Workout/tools/memory.py`'s `plan_adjustments` Mongo collection
  already stores every adjustment ever made (`session_id`, `day_label`,
  `exercise_name`, `new_exercise_name`, `reason`, `created_at`) — today only
  read back once, scoped by `since`, right after a feedback submission
  (`read_exercise_adjustments`). Nothing new to store.

### Backend changes (`Tamrena-Workout`)

**New module `pipeline/plan_parser.py`** — extracts the low-level,
already-tested helpers current living in `plan_finalize.py`
(`_DAY_HEADING`, `_split_row`, `_extract_sets_reps`, the table-boundary
scan) into shared functions both modules import. `enforce_volume_budget`
keeps its own trimming logic untouched — it just calls the shared cell/table
parsing instead of duplicating it.

Add to that module:

```python
@dataclass
class ParsedExercise:
    name: str
    sets: int | None
    reps: str | None
    rest: str | None
    rpe: str | None
    muscle_group: str | None  # best-effort, from the day's DAY MAP muscles

@dataclass
class ParsedDay:
    day_number: int
    label: str          # e.g. "Day 1 - Push Focus"
    target_focus: str   # muscles from the DAY MAP, human-joined
    warmup: str | None
    exercises: list[ParsedExercise]

def parse_weekly_schedule(content: str) -> list[ParsedDay]: ...
```

Reuses the same day-block extraction `enforce_volume_budget` already does
(day heading → table start/end → data rows), but returns structured data
instead of rewriting text. Malformed/unparseable days are skipped (return
what parses; never raise) — matches this codebase's existing "be
conservative, don't touch what you can't confidently classify" stance from
`plan_finalize.py`'s own docstring.

**`tools/memory.py`**: add `read_all_exercise_adjustments(session_id: str) ->
list[dict]` — identical query to the existing `read_exercise_adjustments`
minus the `day_label` and `since` filters (all adjustments ever made for
this session, oldest first, so a later re-swap of the same exercise wins
when matching by name).

**`api/routes/plan.py`**: extend `SessionPlanResponse`:

```python
class SessionPlanResponse(BaseModel):
    status: Literal["ready", "pending", "failed"]
    plan: Optional[str] = None
    error: Optional[str] = None
    days: Optional[list[ParsedDay]] = None  # new
```

In `get_session_plan`, when `status == "ready"`: call
`parse_weekly_schedule(schedule)`, then `read_all_exercise_adjustments`,
and for each parsed exercise whose name matches some adjustment's
`new_exercise_name` (case-insensitive), set `replaced_from` /
`adjustment_reason` from that adjustment record (last-write-wins if
matched more than once). `days` stays `None` while `status != "ready"`.

### Frontend changes (`tamreena-web`)

**`src/lib/api.ts`**: extend `SessionPlanResponse` type to match (`days`,
and `ParsedExercise` gaining `replaced_from`/`adjustment_reason`).

**`src/pages/workout/PlanView.tsx`**:
- Delete `DEFAULT_DAYS` and the `routineDays` local-mock state entirely.
- Render directly from `planData.days` (empty/loading state while
  `status !== "ready"`, matching the existing pending/error handling
  already in this component).
- `handleFeedbackSubmit`'s success path stops hand-patching exercises in
  local state. On a truthy `adjustment_triggered`, it just re-calls
  `getSessionPlan(sessionId)` and replaces `planData` — the "AI Replaced"
  badge (already-written JSX, keyed off `replacedFrom`/`adjustmentReason`)
  now comes from the same persisted source a fresh page load would show,
  instead of an optimistic client patch that disappears on refresh.
- The raw-text accordion stays, as a fallback/debug view.

### Testing

- `Tamrena-Workout/tests/test_plan_parser.py` (new): `parse_weekly_schedule`
  against real plan fixtures (reuse/adapt the fixture style already in
  `tests/test_plan_finalize.py` — trimmed real session content, not
  synthetic). Cases: multi-day plan parses cleanly; a day with a malformed
  sets×reps cell is skipped rather than raising; empty/whitespace content
  returns `[]`.
- Extend `tests/test_session_plan.py`: `GET /sessions/{id}/plan` returns
  `days` matching the written schedule; after writing a
  `plan_adjustments` doc directly (mirroring how `record_exercise_adjustment`
  writes it) and re-fetching, the matching exercise carries
  `replaced_from`/`adjustment_reason`.

---

## Part 2 — CV live-session report (score graph + feedback)

### Why no new storage is needed

Computer-Vision's engine already assigns a `session_id` and exports a full
report whenever `EXPORT_SESSION=true` (already on in its own
`docker-compose.yml`) — the WebSocket `"end"` event already carries it
(`backend/src/server/live_runner.py:233`). tamreena-web's existing proxy
(`app/live_session/routes.py`) relays that event unchanged; the frontend
just currently reads only `data.reps` off it and discards the rest.

### Backend changes (`tamreena-web`)

**New route** in `app/live_session/routes.py`:

```python
@router.get("/report/{session_id}")
async def get_live_session_report(session_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", f"/api/sessions/{session_id}", token=None, base_url=CV_API_URL)
    return proxy_json(resp)
```

Thin passthrough — same `call_upstream`/`proxy_json` helpers already used
by the upload route just above it in this file. A 404 from CV (report
wasn't exported, or the run errored before an id was assigned) passes
through as-is; the frontend treats that as "no report available," not an
error state.

**`LiveSessionResultRequest`**: add `session_id: Optional[str] = None`,
stored alongside the existing fields in the DynamoDB item. Not read back
anywhere yet (no history page exists for CV live sessions today) — this is
forward-compatible plumbing for if/when one gets built, not new scope.

### Frontend changes (`tamreena-web`)

**`src/pages/live-session/LiveSession.tsx`**:
- `LiveState`/the `"end"` handler additionally captures `session_id`
  (already present in the payload, just unread today).
- On reaching `phase === 'complete'`, fire `GET
  /api/live-session/report/{session_id}` (new API function
  `getLiveSessionReport` in `lib/api.ts`, mirroring `getSessionPlan`'s
  shape). While it's loading, keep showing today's plain reps/good/bad
  tally so the screen is never empty.
- New component `SessionReportView` (styled inline like the rest of this
  codebase, not a shadcn port) renders, once the report arrives:
  - **Score-per-rep line chart** — `recharts` (new frontend dependency;
    matches what `Computer-Vision/frontend` already uses, so no new
    charting approach is being invented for this codebase), fed by
    `report.history[].score` / `.good`. Verdict-colored dots, same
    green/red language already used elsewhere in this app.
  - **Mistakes summary** — `report.summary.common_errors` (rule → count)
    as a small ranked list with the one-line coaching tip already present
    in the CV app's rule definitions (`report.rules[].message`).
  - Rep-by-rep expandable detail (the CV app's `RuleEvaluations` table) is
    **explicitly out of scope for v1** — confirmed with the user. The
    chart + mistakes summary answers "how was I exercising"; the
    per-check drill-down is a bigger UI lift for a marginal gain here.
- If the report fetch 404s or otherwise fails: log to console, keep the
  existing plain-tally completion screen exactly as it works today. Report
  fetch failure must never block the completion screen from rendering.

### Testing

- Backend: a test for `GET /api/live-session/report/{id}` — 200
  passthrough of a mocked CV response, 404 passthrough when CV 404s.
- Frontend: this is primarily a rendering/integration concern; manual
  verification once a real report is available (needs a working camera or
  uploaded video through the CV pipeline) — no complex parsing logic like
  Part 1 to unit-test in isolation.

---

## Out of scope (both parts)

- Any change to `Computer-Vision` itself.
- A history/list page for past CV live sessions (Part 2's `session_id`
  plumbing is forward-compatible with one, but building it is not this
  spec).
- Rep-by-rep expandable breakdown in the CV report view (explicitly cut
  from v1, see above).
- Anything about the Nutrition-Plan-Generation service or the InBody OCR
  pipeline — unrelated to both parts here.
