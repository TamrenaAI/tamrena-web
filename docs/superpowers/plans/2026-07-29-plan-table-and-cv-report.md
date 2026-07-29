# Real Workout-Plan Table + CV Live-Session Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Interactive AI Training Routine Table" in tamreena-web show the user's real generated plan (with persisted AI-swap badges) instead of a hardcoded mock, and make the CV live-session completion screen show a score graph + mistakes summary instead of just rep counts.

**Architecture:** Part 1 adds a server-side markdown-to-structured-JSON parser in `Tamrena-Workout` (reusing already-tested table-parsing helpers from `pipeline/plan_finalize.py`), extends `GET /sessions/{id}/plan` to return it, and rewrites `tamreena-web`'s `PlanView.tsx` to render that instead of mock data. Part 2 adds one proxy route in `tamreena-web`'s backend forwarding to Computer-Vision's existing `GET /api/sessions/{id}`, and a new frontend component rendering a `recharts` line chart + mistakes list on session completion.

**Tech Stack:** Python/FastAPI/pytest (Tamrena-Workout), Python/FastAPI/pytest+respx (tamreena-web backend), React/TypeScript/Vite, `recharts` (new dependency).

Spec: `docs/superpowers/specs/2026-07-29-plan-table-and-cv-report-design.md` (this repo).

## Global Constraints

- Never remove/rename `_extract_sets` or `_extract_sets_reps` from `pipeline/plan_finalize.py` at their existing import paths — `tests/test_plan_finalize.py` imports both directly (`from pipeline.plan_finalize import _extract_sets`, `_extract_sets_reps`) and must keep passing unmodified.
- `enforce_volume_budget`'s own trimming/rewriting behavior must not change — Tasks 1-2 only relocate shared *parsing* primitives it already uses; run the full existing `tests/test_plan_finalize.py` suite after Task 1 to confirm zero regressions before moving on.
- Frontend tasks (5, 6, 8, 9, 10) have no test runner in this repo (`tamreena-web/frontend` — confirmed no vitest/jest, no `*.test.*` files). Their verification step is `npm run build` (runs `tsc -b && vite build`) plus explicit manual-check instructions — do not invent fictitious test commands for them.
- New Python code follows this codebase's existing conventions: private module-level helpers prefixed `_`, public ones not; docstrings on every public function explaining *why*, not just what (matches every file read during design).
- The Computer-Vision live-session report proxy route follows the exact existing pattern of its sibling routes in the same file (`call_upstream` / `proxy_json`, no defensive `None`-check beyond what siblings already do) — do not introduce a new error-handling style for one route.

---

### Task 1: Extract shared plan-parsing helpers into `pipeline/plan_parser.py`

**Files:**
- Create: `Tamrena-Workout/pipeline/plan_parser.py`
- Modify: `Tamrena-Workout/pipeline/plan_finalize.py`
- Test: `Tamrena-Workout/tests/test_plan_finalize.py` (existing — must still pass unmodified)

**Interfaces:**
- Produces: `pipeline.plan_parser.parse_day_map(content: str) -> dict[int, dict]` (same shape as the old `_parse_day_map`: `{day_num: {"budget": int, "muscles": list[str], "zone": str}}`), `pipeline.plan_parser.parse_group_ordinals(content: str, muscle: str, zone: str) -> dict[str, int]`, `pipeline.plan_parser.extract_sets_reps(cell: str) -> tuple[int, str] | None`, `pipeline.plan_parser.split_row(line: str) -> list[str]`, `pipeline.plan_parser.DAY_HEADING: re.Pattern` (matches `^###\s+Day\s+(\d+)\b`).

- [ ] **Step 1: Create `pipeline/plan_parser.py` with the relocated helpers**

```python
"""
Shared markdown-schedule parsing primitives, used by both
pipeline/plan_finalize.py (deterministic volume-budget trimming/rewriting)
and pipeline/plan_parser.parse_weekly_schedule (read-only structured JSON
for the API) so both parse the same "### Day N" / pipe-table format the
same way instead of maintaining two independent parsers that could drift.
"""

import re

_SETS_X_REPS = re.compile(r"(\d+)\s*[×xX]\s*(\d+(?:-\d+)?)")
_SETS_UNKNOWN_SEP = re.compile(r"^(\d)\D+(\d+(?:-\d+)?)$")  # malformed "4\x7f12" -> sets=4, reps=12
_SETS_CONCAT = re.compile(r"^(\d)(\d+(?:-\d+)?)$")  # malformed "58" -> sets=5, reps=8

_DAY_MAP_LINE = re.compile(
    r"^Day\s+(\d+)\s*-.*?muscles\s*\[([^\]]+)\]\s*\|\s*max_sets:\s*(\d+)\s*\|\s*intensity:\s*(\S+)",
    re.IGNORECASE,
)
_NUMBERED_EXERCISE = re.compile(r"^(\d+)\.\s+(.+?)\s+\d+\s*[×xX]\s*\d+")

DAY_HEADING = re.compile(r"^###\s+Day\s+(\d+)\b")


def parse_day_map(content: str) -> dict:
    """Day number -> {"budget": int, "muscles": [str,...], "zone": str}."""
    day_map = {}
    for line in content.splitlines():
        match = _DAY_MAP_LINE.match(line.strip())
        if not match:
            continue
        day_num, muscles_raw, budget, zone = match.groups()
        muscles = [m.strip() for m in muscles_raw.split(",") if m.strip()]
        day_map[int(day_num)] = {"budget": int(budget), "muscles": muscles, "zone": zone}
    return day_map


def parse_group_ordinals(content: str, muscle: str, zone: str) -> dict:
    """Last '## {muscle} - {zone}' section -> {exercise_name_lower: ordinal}."""
    heading = f"## {muscle} - {zone}"
    idx = content.rfind(heading)
    if idx == -1:
        return {}
    section = content[idx:]
    end = section.find("\n---")
    if end != -1:
        section = section[:end]

    ordinals = {}
    for line in section.splitlines():
        match = _NUMBERED_EXERCISE.match(line.strip())
        if match:
            ordinal, name = match.groups()
            ordinals[name.strip().lower()] = int(ordinal)
    return ordinals


def extract_sets_reps(cell: str) -> "tuple[int, str] | None":
    match = _SETS_X_REPS.search(cell)
    if match:
        return int(match.group(1)), match.group(2)
    match = _SETS_UNKNOWN_SEP.match(cell.strip())
    if match:
        return int(match.group(1)), match.group(2)
    match = _SETS_CONCAT.match(cell.strip())
    if match:
        return int(match.group(1)), match.group(2)
    return None


def split_row(line: str) -> list:
    cells = [c.strip() for c in line.split("|")]
    if cells and cells[0] == "":
        cells.pop(0)
    if cells and cells[-1] == "":
        cells.pop()
    return cells
```

- [ ] **Step 2: Point `plan_finalize.py` at the relocated helpers instead of its own copies**

Replace this block in `pipeline/plan_finalize.py`:

```python
import re

from tools.memory import _plan_path, find_last_schedule_marker, write_plan_memory

_SETS_X_REPS = re.compile(r"(\d+)\s*[×xX]\s*(\d+(?:-\d+)?)")
_SETS_UNKNOWN_SEP = re.compile(r"^(\d)\D+(\d+(?:-\d+)?)$")  # malformed "4\x7f12" -> sets=4, reps=12
_SETS_CONCAT = re.compile(r"^(\d)(\d+(?:-\d+)?)$")  # malformed "58" -> sets=5, reps=8

_DAY_MAP_LINE = re.compile(
    r"^Day\s+(\d+)\s*-.*?muscles\s*\[([^\]]+)\]\s*\|\s*max_sets:\s*(\d+)\s*\|\s*intensity:\s*(\S+)",
    re.IGNORECASE,
)
_GROUP_HEADING = re.compile(r"^##\s+(\S+)\s*-\s*(\S+)\s*$")
_NUMBERED_EXERCISE = re.compile(r"^(\d+)\.\s+(.+?)\s+\d+\s*[×xX]\s*\d+")
_DAY_HEADING = re.compile(r"^###\s+Day\s+(\d+)\b")
_VOLUME_ROW = re.compile(r"^\|\s*([A-Za-z_]+)\s*\|\s*(\d+)\s*\|\s*([\d]+-[\d]+|\S+)\s*\|\s*(\S+)\s*\|$")

MIN_SETS_FLOOR = 2


def _parse_day_map(content: str) -> dict:
    """Day number -> {"budget": int, "muscles": [str,...], "zone": str}."""
    day_map = {}
    for line in content.splitlines():
        match = _DAY_MAP_LINE.match(line.strip())
        if not match:
            continue
        day_num, muscles_raw, budget, zone = match.groups()
        muscles = [m.strip() for m in muscles_raw.split(",") if m.strip()]
        day_map[int(day_num)] = {"budget": int(budget), "muscles": muscles, "zone": zone}
    return day_map


def _parse_group_ordinals(content: str, muscle: str, zone: str) -> dict:
    """Last '## {muscle} - {zone}' section -> {exercise_name_lower: ordinal}."""
    heading = f"## {muscle} - {zone}"
    idx = content.rfind(heading)
    if idx == -1:
        return {}
    section = content[idx:]
    end = section.find("\n---")
    if end != -1:
        section = section[:end]

    ordinals = {}
    for line in section.splitlines():
        match = _NUMBERED_EXERCISE.match(line.strip())
        if match:
            ordinal, name = match.groups()
            ordinals[name.strip().lower()] = int(ordinal)
    return ordinals


def _extract_sets_reps(cell: str) -> "tuple[int, str] | None":
    match = _SETS_X_REPS.search(cell)
    if match:
        return int(match.group(1)), match.group(2)
    match = _SETS_UNKNOWN_SEP.match(cell.strip())
    if match:
        return int(match.group(1)), match.group(2)
    match = _SETS_CONCAT.match(cell.strip())
    if match:
        return int(match.group(1)), match.group(2)
    return None


def _extract_sets(cell: str) -> "int | None":
    result = _extract_sets_reps(cell)
    return result[0] if result else None


def _split_row(line: str) -> list:
    cells = [c.strip() for c in line.split("|")]
    if cells and cells[0] == "":
        cells.pop(0)
    if cells and cells[-1] == "":
        cells.pop()
    return cells
```

with:

```python
import re

from pipeline.plan_parser import (
    DAY_HEADING as _DAY_HEADING,
    extract_sets_reps as _extract_sets_reps,
    parse_day_map as _parse_day_map,
    parse_group_ordinals as _parse_group_ordinals,
    split_row as _split_row,
)
from tools.memory import _plan_path, find_last_schedule_marker, write_plan_memory

_GROUP_HEADING = re.compile(r"^##\s+(\S+)\s*-\s*(\S+)\s*$")
_VOLUME_ROW = re.compile(r"^\|\s*([A-Za-z_]+)\s*\|\s*(\d+)\s*\|\s*([\d]+-[\d]+|\S+)\s*\|\s*(\S+)\s*\|$")

MIN_SETS_FLOOR = 2


def _extract_sets(cell: str) -> "int | None":
    result = _extract_sets_reps(cell)
    return result[0] if result else None
```

Nothing else in `plan_finalize.py` changes — `enforce_volume_budget` already refers to `_parse_day_map`, `_parse_group_ordinals`, `_extract_sets_reps`, `_split_row`, `_DAY_HEADING` by those exact local names, which now resolve via the import aliases instead of local definitions.

- [ ] **Step 3: Run the existing full test suite to confirm zero regressions**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_plan_finalize.py -v`
Expected: all tests still PASS (same count as before this change — this task only relocates code, changes no behavior).

- [ ] **Step 4: Run the full backend suite too, since this touches a shared module**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest -q`
Expected: all 156 tests pass (matches the count from the last full run this session).

- [ ] **Step 5: Commit**

```bash
cd "Tamrena-Workout"
git add pipeline/plan_parser.py pipeline/plan_finalize.py
git commit -m "refactor: extract shared plan-parsing helpers into pipeline/plan_parser.py"
```

---

### Task 2: Add `parse_weekly_schedule` to `pipeline/plan_parser.py`

**Files:**
- Modify: `Tamrena-Workout/pipeline/plan_parser.py`
- Test: Create `Tamrena-Workout/tests/test_plan_parser.py`

**Interfaces:**
- Consumes: `tools.memory.find_last_schedule_marker(content: str) -> tuple[int, str] | None` (existing), and this task's own `parse_day_map`/`parse_group_ordinals`/`extract_sets_reps`/`split_row`/`DAY_HEADING` from Task 1.
- Produces: `pipeline.plan_parser.ParsedExercise` (pydantic `BaseModel`: `name: str`, `sets: int | None`, `reps: str | None`, `rest: str | None`, `rpe: str | None`, `muscle_group: str | None = None`, `replaced_from: str | None = None`, `adjustment_reason: str | None = None`), `pipeline.plan_parser.ParsedDay` (`day_number: int`, `label: str`, `target_focus: str`, `warmup: str | None`, `exercises: list[ParsedExercise]`), `pipeline.plan_parser.parse_weekly_schedule(full_plan_content: str) -> list[ParsedDay]` — used by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `Tamrena-Workout/tests/test_plan_parser.py`:

```python
"""
Tests for pipeline.plan_parser.parse_weekly_schedule — the structured-JSON
counterpart to enforce_volume_budget's rewriting logic, used by
GET /sessions/{id}/plan so the frontend can render the real generated plan
instead of a client-side mock. Fixture content mirrors the real-session
shape already exercised in tests/test_plan_finalize.py (same DAY MAP /
group-section / Weekly Schedule structure), trimmed to what this parser
itself needs to prove.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.plan_parser import parse_weekly_schedule

TWO_DAY_PLAN = """

## User Profile + Plan Header
Goal: hypertrophy
Paradigm: hypertrophy
Days per week: 2
Experience: beginner
Session duration: 45min

Day 1 - hard: muscles [chest, shoulders] | max_sets: 10 | intensity: hard
Day 2 - medium: muscles [back, arms] | max_sets: 10 | intensity: medium

---

## chest - hard
1. Flat Barbell Bench Press 4x8 | Rest 2-3 min | RPE 8
   -> heavy compound pressing.
2. Cable Fly 3x12 | Rest 90s | RPE 7
   -> isolation.

Evidence: compound presses prioritized.

---

## shoulders - hard
1. Seated Dumbbell Overhead Press 3x8 | Rest 2-3 min | RPE 8
   -> compound press.

Evidence: compound press.

---

## back - medium
1. Lat Pulldown 4x10 | Rest 90s | RPE 7
   -> compound pull.

Evidence: compound pull.

---

## arms - medium
1. Barbell Curl 3x10 | Rest 60s | RPE 7
   -> isolation biceps.

Evidence: isolation.

---

## Weekly Schedule
### Day 1 -- Monday: Push (Chest, Shoulders) - Hard Session
**Warm-up:** Dynamic shoulder circles and arm swings.

| # | Exercise | Sets x Reps | Rest | RPE |
|---|----------|-------------|------|-----|
| 1 | Flat Barbell Bench Press | 4x8 | 2-3 min | 8 |
| 2 | Cable Fly | 3x12 | 90s | 7 |
| 3 | Seated Dumbbell Overhead Press | 3x8 | 2-3 min | 8 |

**Coaching notes:** Focus on controlled eccentric phases.

---

### Day 2 -- Tuesday: Pull (Back, Arms) - Medium Session
**Warm-up:** Light rowing and band pull-aparts.

| # | Exercise | Sets x Reps | Rest | RPE |
|---|----------|-------------|------|-----|
| 1 | Lat Pulldown | 4x10 | 90s | 7 |
| 2 | Barbell Curl | 3x10 | 60s | 7 |

**Coaching notes:** Keep elbows pinned on curls.

---

### Weekly Volume Summary
| Muscle Group | Sets/Week | Target | Status |
|---|---|---|---|
| chest | 7 | 10-12 | under |
| shoulders | 3 | 10-12 | under |
| back | 4 | 10-12 | under |
| arms | 3 | 10-12 | under |

### Recovery Notes
- No asymmetry corrections needed.
"""


def test_parses_both_days_in_order():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    assert [d.day_number for d in days] == [1, 2]
    assert days[0].label == "Day 1 -- Monday: Push (Chest, Shoulders) - Hard Session"
    assert days[1].label == "Day 2 -- Tuesday: Pull (Back, Arms) - Medium Session"


def test_parses_target_focus_from_day_map():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    assert days[0].target_focus == "CHEST, SHOULDERS"
    assert days[1].target_focus == "BACK, ARMS"


def test_parses_warmup_line():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    assert days[0].warmup == "Dynamic shoulder circles and arm swings."


def test_parses_exercises_with_sets_reps_rest_rpe():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    bench = days[0].exercises[0]
    assert bench.name == "Flat Barbell Bench Press"
    assert bench.sets == 4
    assert bench.reps == "8"
    assert bench.rest == "2-3 min"
    assert bench.rpe == "8"


def test_resolves_muscle_group_per_exercise():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    exercises_by_name = {e.name: e for e in days[0].exercises}
    assert exercises_by_name["Flat Barbell Bench Press"].muscle_group == "chest"
    assert exercises_by_name["Cable Fly"].muscle_group == "chest"
    assert exercises_by_name["Seated Dumbbell Overhead Press"].muscle_group == "shoulders"


def test_new_fields_default_to_none():
    days = parse_weekly_schedule(TWO_DAY_PLAN)
    bench = days[0].exercises[0]
    assert bench.replaced_from is None
    assert bench.adjustment_reason is None


def test_returns_empty_list_when_no_schedule_section():
    assert parse_weekly_schedule("no schedule here, just prose") == []


def test_returns_empty_list_for_empty_content():
    assert parse_weekly_schedule("") == []


def test_malformed_sets_reps_cell_still_parses_row_with_none_sets_reps():
    malformed = TWO_DAY_PLAN.replace("| 1 | Flat Barbell Bench Press | 4x8 | 2-3 min | 8 |",
                                      "| 1 | Flat Barbell Bench Press | n/a | 2-3 min | 8 |")
    days = parse_weekly_schedule(malformed)
    bench = days[0].exercises[0]
    assert bench.name == "Flat Barbell Bench Press"
    assert bench.sets is None
    assert bench.reps is None
    assert bench.rest == "2-3 min"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_plan_parser.py -v`
Expected: FAIL with `ImportError: cannot import name 'parse_weekly_schedule'` (or `ParsedExercise`/`ParsedDay` not found).

- [ ] **Step 3: Implement `ParsedExercise`, `ParsedDay`, `parse_weekly_schedule`**

Append to `pipeline/plan_parser.py` (add `from pydantic import BaseModel` to the top of the file alongside the existing `import re`):

```python
from pydantic import BaseModel


class ParsedExercise(BaseModel):
    name: str
    sets: "int | None" = None
    reps: "str | None" = None
    rest: "str | None" = None
    rpe: "str | None" = None
    muscle_group: "str | None" = None
    replaced_from: "str | None" = None
    adjustment_reason: "str | None" = None


class ParsedDay(BaseModel):
    day_number: int
    label: str
    target_focus: str
    warmup: "str | None" = None
    exercises: "list[ParsedExercise]" = []


def parse_weekly_schedule(full_plan_content: str) -> "list[ParsedDay]":
    """Structured, read-only counterpart to enforce_volume_budget: parses
    the LAST '## Weekly Schedule' section into ParsedDay/ParsedExercise
    objects for GET /sessions/{id}/plan to return as JSON, instead of the
    frontend either showing raw markdown or (as found during design) a
    hardcoded mock disconnected from the real plan entirely.

    full_plan_content must be the WHOLE plan.md file (tools.memory.
    read_full_plan), not just tools.memory.read_weekly_schedule's return
    value — the DAY MAP and per-muscle-group exercise lists this needs for
    target_focus/muscle_group live earlier in the file, outside the
    schedule section itself.

    Same conservative stance as plan_finalize.py: unparseable days/rows are
    skipped rather than raising — returns whatever DOES parse.
    """
    from tools.memory import find_last_schedule_marker

    marker = find_last_schedule_marker(full_plan_content)
    if marker is None:
        return []
    schedule_idx, _heading = marker
    day_map = parse_day_map(full_plan_content)

    lines = full_plan_content[schedule_idx:].splitlines()
    tail_marker_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("### Weekly Volume Summary") or line.strip().startswith("### Recovery Notes"):
            tail_marker_idx = i
            break
    day_lines_all = lines[1:tail_marker_idx] if tail_marker_idx is not None else lines[1:]

    day_blocks = []
    current = None
    for line in day_lines_all:
        heading = DAY_HEADING.match(line.strip())
        if heading:
            current = (int(heading.group(1)), [line])
            day_blocks.append(current)
        elif current is not None:
            current[1].append(line)

    parsed_days = []
    for day_num, day_lines in day_blocks:
        day_info = day_map.get(day_num, {})
        muscles = day_info.get("muscles", [])
        zone = day_info.get("zone", "")

        muscle_by_name = {}
        for muscle in muscles:
            for name in parse_group_ordinals(full_plan_content, muscle, zone):
                if name not in muscle_by_name:
                    muscle_by_name[name] = muscle

        label = re.sub(r"^###\s+", "", day_lines[0].strip())
        warmup = None
        table_start = None
        table_end = None
        for i, line in enumerate(day_lines):
            stripped = line.strip()
            if warmup is None and stripped.startswith("**Warm-up:**"):
                warmup = stripped[len("**Warm-up:**"):].strip()
            if stripped.startswith("|"):
                if table_start is None:
                    table_start = i
                table_end = i

        exercises = []
        if table_start is not None:
            for row_line in day_lines[table_start + 2: table_end + 1]:
                cells = split_row(row_line)
                if len(cells) < 5:
                    continue
                name = cells[1]
                sets_reps = extract_sets_reps(cells[2])
                sets, reps = sets_reps if sets_reps else (None, None)
                exercises.append(ParsedExercise(
                    name=name,
                    sets=sets,
                    reps=reps,
                    rest=cells[3] or None,
                    rpe=cells[4] or None,
                    muscle_group=muscle_by_name.get(name.strip().lower()),
                ))

        parsed_days.append(ParsedDay(
            day_number=day_num,
            label=label,
            target_focus=", ".join(m.upper() for m in muscles),
            warmup=warmup,
            exercises=exercises,
        ))

    parsed_days.sort(key=lambda d: d.day_number)
    return parsed_days
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_plan_parser.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest -q`
Expected: all tests pass (previous count + the new `test_plan_parser.py` tests).

- [ ] **Step 6: Commit**

```bash
cd "Tamrena-Workout"
git add pipeline/plan_parser.py tests/test_plan_parser.py
git commit -m "feat: add parse_weekly_schedule for structured plan JSON"
```

---

### Task 3: Add `read_full_plan` and `read_all_exercise_adjustments` to `tools/memory.py`

**Files:**
- Modify: `Tamrena-Workout/tools/memory.py`
- Test: Create `Tamrena-Workout/tests/test_memory_plan_reads.py`

**Interfaces:**
- Consumes: existing `_plan_path(session_id) -> str`, `get_db()` (already imported in `tools/memory.py`).
- Produces: `tools.memory.read_full_plan(session_id: str) -> str | None`, `tools.memory.read_all_exercise_adjustments(session_id: str) -> list[dict]` (each dict: `exercise_name`, `new_exercise_name`, `reason`) — both used by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `Tamrena-Workout/tests/test_memory_plan_reads.py`:

```python
"""
Tests for tools.memory.read_full_plan and read_all_exercise_adjustments —
the two reads GET /sessions/{id}/plan needs to build structured, swap-aware
plan JSON: the whole plan.md (parse_weekly_schedule needs the DAY MAP that
lives outside what read_weekly_schedule already returns), and every
adjustment ever recorded for a session (unlike read_exercise_adjustments,
which is scoped to one day_label/one invocation's `since` window).
"""

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import SESSION_DIR
from tools.memory import get_db, read_all_exercise_adjustments, read_full_plan


def _make_session(content: str) -> str:
    session_id = str(uuid.uuid4())
    session_path = os.path.join(SESSION_DIR, session_id)
    os.makedirs(session_path, exist_ok=True)
    with open(os.path.join(session_path, "plan.md"), "w", encoding="utf-8") as f:
        f.write(content)
    return session_id


def test_read_full_plan_returns_whole_file_content():
    session_id = _make_session("## Day Map\nDay 1 ...\n\n## Weekly Schedule\n### Day 1\ncontent")
    content = read_full_plan(session_id)
    assert content is not None
    assert "## Day Map" in content
    assert "## Weekly Schedule" in content


def test_read_full_plan_returns_none_when_missing():
    assert read_full_plan(str(uuid.uuid4())) is None


def test_read_all_exercise_adjustments_returns_every_recorded_entry_oldest_first():
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    get_db().plan_adjustments.insert_many([
        {
            "session_id": session_id, "day_label": "Day 1", "exercise_name": "Barbell Squat",
            "new_exercise_name": "Leg Press", "sets": None, "reps": None, "rpe": None,
            "reason": "Knee pain reported", "created_at": now - timedelta(minutes=5),
        },
        {
            "session_id": session_id, "day_label": "Day 2", "exercise_name": "Bench Press",
            "new_exercise_name": None, "sets": 3, "reps": "10", "rpe": 7,
            "reason": "Too easy, reduced sets", "created_at": now,
        },
    ])
    adjustments = read_all_exercise_adjustments(session_id)
    assert len(adjustments) == 2
    assert adjustments[0]["exercise_name"] == "Barbell Squat"
    assert adjustments[0]["new_exercise_name"] == "Leg Press"
    assert adjustments[0]["reason"] == "Knee pain reported"
    assert adjustments[1]["exercise_name"] == "Bench Press"


def test_read_all_exercise_adjustments_returns_empty_list_when_none_recorded():
    assert read_all_exercise_adjustments(str(uuid.uuid4())) == []


def test_read_all_exercise_adjustments_is_scoped_to_session_id():
    session_a = str(uuid.uuid4())
    session_b = str(uuid.uuid4())
    get_db().plan_adjustments.insert_one({
        "session_id": session_a, "day_label": "Day 1", "exercise_name": "Squat",
        "new_exercise_name": "Leg Press", "sets": None, "reps": None, "rpe": None,
        "reason": "pain", "created_at": datetime.now(timezone.utc),
    })
    assert read_all_exercise_adjustments(session_b) == []
    assert len(read_all_exercise_adjustments(session_a)) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_memory_plan_reads.py -v`
Expected: FAIL with `ImportError: cannot import name 'read_full_plan'` (or `read_all_exercise_adjustments`).

- [ ] **Step 3: Implement both functions**

Add to `tools/memory.py`, directly below `read_weekly_schedule` (after its closing `return section` line):

```python
def read_full_plan(session_id: str) -> "str | None":
    """The raw plan.md content, unlike read_weekly_schedule which returns
    only the last schedule section. pipeline.plan_parser.parse_weekly_schedule
    needs the DAY MAP and per-muscle-group exercise lists that live earlier
    in the file, outside the schedule section itself. Returns None if the
    plan file doesn't exist yet."""
    path = _plan_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return f.read()
```

Add to `tools/memory.py`, directly below `read_exercise_adjustments` (after its closing `]` of the list comprehension):

```python
def read_all_exercise_adjustments(session_id: str) -> list[dict]:
    """Every structured adjustment ever recorded for this session, oldest
    first (so a later re-swap of the same exercise wins when matching by
    name in GET /sessions/{id}/plan) — unlike read_exercise_adjustments,
    not scoped to one day_label or one invocation's `since` window. Lets
    the plan-table endpoint show "AI Replaced" on whatever exercise is
    CURRENTLY in the plan, persisted across page reloads instead of only
    right after the feedback call that triggered the swap."""
    docs = get_db().plan_adjustments.find({"session_id": session_id}).sort("created_at", 1)
    return [
        {
            "exercise_name": d["exercise_name"],
            "new_exercise_name": d.get("new_exercise_name"),
            "reason": d["reason"],
        }
        for d in docs
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_memory_plan_reads.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "Tamrena-Workout"
git add tools/memory.py tests/test_memory_plan_reads.py
git commit -m "feat: add read_full_plan and read_all_exercise_adjustments"
```

---

### Task 4: Extend `GET /sessions/{id}/plan` with structured `days`

**Files:**
- Modify: `Tamrena-Workout/api/routes/plan.py`
- Test: Modify `Tamrena-Workout/tests/test_session_plan.py` (existing)

**Interfaces:**
- Consumes: `pipeline.plan_parser.parse_weekly_schedule` (Task 2), `tools.memory.read_full_plan`, `tools.memory.read_all_exercise_adjustments` (Task 3).
- Produces: `SessionPlanResponse.days: list[ParsedDay] | None` — consumed by Task 5 (frontend types).

- [ ] **Step 1: Write the failing test**

Add to `Tamrena-Workout/tests/test_session_plan.py` (append after `test_failed_when_pipeline_errored`, before `test_ready_when_schedule_has_been_written`):

```python
def test_ready_response_includes_parsed_days_and_swap_badge():
    import api.main as m
    from auth import ownership
    from tools import memory as tools_memory

    owner = _make_user("owner5")
    session_id = "s5"
    ownership.create_session(session_id, user_id=owner["id"], goal="hypertrophy")

    full_plan = """

## User Profile + Plan Header
Day 1 - hard: muscles [chest] | max_sets: 10 | intensity: hard

---

## chest - hard
1. Flat Barbell Bench Press 4x8 | Rest 2-3 min | RPE 8
   -> heavy compound pressing.
2. Cable Fly 3x12 | Rest 90s | RPE 7
   -> isolation.

Evidence: compound presses prioritized.

---

## Weekly Schedule
### Day 1 -- Monday: Push (Chest) - Hard Session
**Warm-up:** Dynamic shoulder circles.

| # | Exercise | Sets x Reps | Rest | RPE |
|---|----------|-------------|------|-----|
| 1 | Flat Barbell Bench Press | 4x8 | 2-3 min | 8 |
| 2 | Machine Chest Press | 3x12 | 90s | 7 |

**Coaching notes:** Focus on controlled eccentrics.
"""
    session_dir = os.path.join(tools_memory.SESSION_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    with open(os.path.join(session_dir, "plan.md"), "w", encoding="utf-8") as f:
        f.write(full_plan)

    tools_memory.get_db().plan_adjustments.insert_one({
        "session_id": session_id, "day_label": "Day 1 -- Monday: Push (Chest) - Hard Session",
        "exercise_name": "Cable Fly", "new_exercise_name": "Machine Chest Press",
        "sets": None, "reps": None, "rpe": None,
        "reason": "Reported shoulder pain on Cable Fly",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    })

    client = TestClient(m.app)
    token = tokens.create_access_token(user_id=owner["id"])
    r = client.get(f"/sessions/{session_id}/plan", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["days"] is not None
    day1 = body["days"][0]
    assert day1["day_number"] == 1
    exercises_by_name = {e["name"]: e for e in day1["exercises"]}
    assert exercises_by_name["Flat Barbell Bench Press"]["replaced_from"] is None
    swapped = exercises_by_name["Machine Chest Press"]
    assert swapped["replaced_from"] == "Cable Fly"
    assert swapped["adjustment_reason"] == "Reported shoulder pain on Cable Fly"


def test_pending_response_has_no_days():
    import api.main as m

    owner = _make_user("owner6")
    ownership.create_session("s6", user_id=owner["id"], goal="hypertrophy")

    client = TestClient(m.app)
    token = tokens.create_access_token(user_id=owner["id"])
    r = client.get("/sessions/s6/plan", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["days"] is None
```

Add `import os` to the top of `test_session_plan.py` if not already present (it currently imports `os` and `sys` — confirm, no change needed if so).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_session_plan.py -v`
Expected: FAIL — `body["days"]` is a `KeyError` / assertion failure (field doesn't exist yet on the response).

- [ ] **Step 3: Implement the change in `api/routes/plan.py`**

Modify the imports near the top of `api/routes/plan.py` — change:

```python
from auth.ownership import create_session, get_session, list_sessions_for_user, update_session_status, user_owns_session
```

to:

```python
from auth.ownership import create_session, get_session, list_sessions_for_user, update_session_status, user_owns_session
from pipeline.plan_parser import ParsedDay, parse_weekly_schedule
```

and change:

```python
from tools.memory import read_progress_report, read_weekly_schedule
```

to:

```python
from tools.memory import read_all_exercise_adjustments, read_full_plan, read_progress_report, read_weekly_schedule
```

Modify `SessionPlanResponse`:

```python
class SessionPlanResponse(BaseModel):
    status: Literal["ready", "pending", "failed"]
    plan: Optional[str] = None
    error: Optional[str] = None
    days: Optional[list[ParsedDay]] = None
```

Modify `get_session_plan`'s body — replace:

```python
    schedule = read_weekly_schedule(session_id)
    if schedule is not None:
        return SessionPlanResponse(status="ready", plan=schedule)

    session = get_session(session_id)
    if session is not None and session.get("status") == "failed":
        return SessionPlanResponse(status="failed", error=session.get("error"))
    return SessionPlanResponse(status="pending", plan=None)
```

with:

```python
    schedule = read_weekly_schedule(session_id)
    if schedule is not None:
        full_content = read_full_plan(session_id) or schedule
        days = parse_weekly_schedule(full_content)

        replacements = {
            adj["new_exercise_name"].strip().lower(): adj
            for adj in read_all_exercise_adjustments(session_id)
            if adj.get("new_exercise_name")
        }
        for day in days:
            for exercise in day.exercises:
                match = replacements.get(exercise.name.strip().lower())
                if match:
                    exercise.replaced_from = match["exercise_name"]
                    exercise.adjustment_reason = match["reason"]

        return SessionPlanResponse(status="ready", plan=schedule, days=days)

    session = get_session(session_id)
    if session is not None and session.get("status") == "failed":
        return SessionPlanResponse(status="failed", error=session.get("error"))
    return SessionPlanResponse(status="pending", plan=None)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest tests/test_session_plan.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd Tamrena-Workout && "D:/anaconda/envs/tamreena/python.exe" -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Rebuild and restart the workout API container, spot-check live**

```bash
cd "Tamrena-Workout"
docker compose up -d --build api
```

Then, using a real session_id from a plan generated earlier this session (or generate a fresh one through the tamreena-web UI at http://localhost:5174), run:

```bash
curl -s http://localhost:8001/sessions/<session_id>/plan -H "Authorization: Bearer <token>" | python -m json.tool
```

Expected: response includes a `days` array with real parsed exercises.

- [ ] **Step 7: Commit**

```bash
cd "Tamrena-Workout"
git add api/routes/plan.py tests/test_session_plan.py
git commit -m "feat: return structured, swap-aware days in GET /sessions/{id}/plan"
```

---

### Task 5: Extend `tamreena-web` frontend types for the new `days` field

**Files:**
- Modify: `tamreena-web/frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `ParsedExercise`, `ParsedDay` TypeScript interfaces, extended `SessionPlanResponse` — consumed by Task 6.

- [ ] **Step 1: Update `SessionPlanResponse` and add the new types**

In `frontend/src/lib/api.ts`, replace:

```typescript
export interface SessionPlanResponse {
  status: 'ready' | 'pending';
  plan: string | null;
}
```

with:

```typescript
export interface ParsedExercise {
  name: string;
  sets: number | null;
  reps: string | null;
  rest: string | null;
  rpe: string | null;
  muscle_group: string | null;
  replaced_from: string | null;
  adjustment_reason: string | null;
}

export interface ParsedDay {
  day_number: number;
  label: string;
  target_focus: string;
  warmup: string | null;
  exercises: ParsedExercise[];
}

export interface SessionPlanResponse {
  status: 'ready' | 'pending' | 'failed';
  plan: string | null;
  error?: string | null;
  days: ParsedDay[] | null;
}
```

(The `status: 'failed'` and `error` fields were already returned by the backend from an earlier session fix but not reflected in this type — adding them now since Task 6 touches the same surface.)

- [ ] **Step 2: Verify the build still type-checks**

Run: `cd tamreena-web/frontend && npm run build`
Expected: succeeds (no consumers of the old narrower `SessionPlanResponse` type break — Task 6 is the only one that reads `.plan`/`.status` today, updated next).

- [ ] **Step 3: Commit**

```bash
cd "tamreena-web"
git add frontend/src/lib/api.ts
git commit -m "feat: add ParsedDay/ParsedExercise types for the real plan table"
```

---

### Task 6: Rewrite `PlanView.tsx` to render the real plan

**Files:**
- Modify: `tamreena-web/frontend/src/pages/workout/PlanView.tsx`

**Interfaces:**
- Consumes: `SessionPlanResponse`, `ParsedDay`, `ParsedExercise` (Task 5), existing `getSessionPlan`, `submitFeedback`, `ExerciseAdjustment`, `ExerciseFeedback` from `lib/api.ts` (unchanged).

- [ ] **Step 1: Remove the mock and wire the component to real data**

Rewrite `frontend/src/pages/workout/PlanView.tsx` in full:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  getSessionPlan,
  submitFeedback,
  type ExerciseFeedback,
  type ParsedDay,
  type ParsedExercise,
  type SessionPlanResponse,
} from '../../lib/api';

function PlanView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [planData, setPlanData] = useState<SessionPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeDayId, setActiveDayId] = useState<number | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<ParsedExercise | null>(null);
  const [dayLabel, setDayLabel] = useState<string>('');
  const [exerciseName, setExerciseName] = useState<string>('');
  const [difficulty, setDifficulty] = useState<ExerciseFeedback['difficulty']>('just_right');
  const [pain, setPain] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPlan = () => {
    if (!sessionId) return;
    getSessionPlan(sessionId)
      .then((data) => {
        setPlanData(data);
        if (data.days && data.days.length > 0) {
          setActiveDayId((current) => current ?? data.days![0].day_number);
          setDayLabel((current) => current || data.days![0].label);
          const firstDay = data.days[0];
          if (firstDay.exercises.length > 0) {
            setExerciseName((current) => current || firstDay.exercises[0].name);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load plan'));
  };

  useEffect(loadPlan, [sessionId]);

  const days: ParsedDay[] = planData?.days ?? [];
  const activeDay = days.find((d) => d.day_number === activeDayId) ?? days[0];
  const selectedDayObject = days.find((d) => d.label === dayLabel) ?? activeDay;

  const handleDaySelectChange = (newDayLabel: string) => {
    setDayLabel(newDayLabel);
    const dayObj = days.find((d) => d.label === newDayLabel);
    if (dayObj && dayObj.exercises.length > 0) {
      setExerciseName(dayObj.exercises[0].name);
      setSelectedExercise(dayObj.exercises[0]);
    }
  };

  const handleOpenFeedback = (exercise: ParsedExercise) => {
    setSelectedExercise(exercise);
    setExerciseName(exercise.name);
    if (activeDay) setDayLabel(activeDay.label);
    setDifficulty('just_right');
    setPain(false);
    setFeedbackNote('');
    setFeedbackResult(null);

    const el = document.getElementById('exercise-feedback-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFeedbackSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setSubmitting(true);
    setFeedbackResult(null);
    try {
      const result = await submitFeedback(sessionId, dayLabel, [
        { name: exerciseName, difficulty, pain, note: feedbackNote || undefined },
      ]);

      if (result.adjustment_triggered && result.adjustments && result.adjustments.length > 0) {
        const adj = result.adjustments[0];
        setFeedbackResult(
          adj.new_exercise_name
            ? `✨ AI Core Adjusted Routine: Swapped for ${adj.new_exercise_name}! (${adj.reason})`
            : result.summary ?? 'Feedback recorded and the plan was adjusted.',
        );
        // The persisted plan is the source of truth for what changed — refetch
        // instead of hand-patching local state, so the "AI Replaced" badge
        // survives a refresh exactly like a fresh page load would show it.
        loadPlan();
      } else {
        setFeedbackResult(result.summary ?? 'Feedback recorded successfully by AI Core.');
      }
    } catch (err) {
      setFeedbackResult(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!planData || planData.status === 'pending') {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>Loading AI Training Protocol...</p>
      </div>
    );
  }

  if (planData.status === 'failed') {
    return (
      <div style={{ padding: '20px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fda4af' }}>
        ⚠️ Plan generation failed{planData.error ? `: ${planData.error}` : '.'}
      </div>
    );
  }

  if (!activeDay) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
        <p style={{ fontWeight: 600 }}>No training days were found in this plan.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge badge-emerald">HYPERTROPHY & STRENGTH PROTOCOL</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Session #{sessionId?.slice(-6)}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
            Interactive AI Training Routine Table
          </h1>
        </div>

        <button onClick={() => window.print()} className="btn btn-secondary" style={{ gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path></svg>
          Export Plan (PDF)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {days.map((day) => {
          const isActive = day.day_number === activeDay.day_number;
          return (
            <button
              key={day.day_number}
              onClick={() => {
                setActiveDayId(day.day_number);
                setDayLabel(day.label);
                if (day.exercises.length > 0) setExerciseName(day.exercises[0].name);
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: isActive ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.7)',
                color: isActive ? '#34d399' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none',
              }}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {activeDay.label}
            </h2>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em' }}>
              TARGET FOCUS: {activeDay.target_focus}
            </span>
          </div>

          <span className="badge badge-emerald">
            {activeDay.exercises.length} EXERCISES
          </span>
        </div>

        {activeDay.warmup && (
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              WARM-UP & MOBILITY PROTOCOL:
            </span>
            <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: 0 }}>
              {activeDay.warmup}
            </p>
          </div>
        )}

        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ background: 'rgba(7, 10, 17, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Exercise Name</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Target Muscle</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Volume Split</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Target RPE & Rest</th>
                <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Log & Adjust</th>
              </tr>
            </thead>
            <tbody>
              {activeDay.exercises.map((ex, idx) => (
                <tr key={`${ex.name}-${idx}`} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent' }}>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
                      {ex.name}
                    </div>
                    {ex.replaced_from && (
                      <span className="badge badge-amber" style={{ padding: '2px 6px', fontSize: '10px', marginTop: '4px' }}>
                        ⚡ AI Replaced (was {ex.replaced_from})
                      </span>
                    )}
                    {ex.adjustment_reason && (
                      <p style={{ fontSize: '11px', color: '#fbbf24', margin: '2px 0 0 0' }}>
                        Reason: {ex.adjustment_reason}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className="badge badge-emerald" style={{ padding: '4px 10px', fontSize: '11px' }}>
                      {ex.muscle_group ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    {ex.sets != null && ex.reps ? `${ex.sets} sets × ${ex.reps} reps` : '—'}
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#cbd5e1' }}>
                    {ex.rpe ? `RPE ${ex.rpe}` : ''}{ex.rpe && ex.rest ? ' · ' : ''}{ex.rest ? `${ex.rest} rest` : ''}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenFeedback(ex)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '12.5px', gap: '6px' }}
                    >
                      <span>✍️ Log Feedback</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details style={{ marginTop: '16px' }}>
          <summary style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            View Full Raw AI Plan Stream Text output
          </summary>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-sans)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: '#94a3b8',
              backgroundColor: 'rgba(7, 10, 17, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '12px',
            }}
          >
            {planData.plan}
          </pre>
        </details>

        <div id="exercise-feedback-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ color: '#34d399' }}>⚡</span>
            <h4 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.05em', color: '#34d399', textTransform: 'uppercase', margin: 0 }}>
              AI Overload & Exercise Swap Studio
            </h4>
          </div>

          <form onSubmit={handleFeedbackSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Training Day</label>
              <select
                id="feedback-day-label"
                value={dayLabel}
                onChange={(e) => handleDaySelectChange(e.target.value)}
                className="form-select"
                required
              >
                {days.map((d) => (
                  <option key={d.day_number} value={d.label} style={{ background: '#0f172a' }}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exercise Name</label>
              <select
                id="feedback-exercise-name"
                value={exerciseName}
                onChange={(e) => {
                  setExerciseName(e.target.value);
                  const ex = selectedDayObject?.exercises.find((item) => item.name === e.target.value);
                  if (ex) setSelectedExercise(ex);
                }}
                className="form-select"
                required
              >
                {(selectedDayObject?.exercises ?? []).map((ex) => (
                  <option key={ex.name} value={ex.name} style={{ background: '#0f172a' }}>
                    {ex.name}{ex.muscle_group ? ` (${ex.muscle_group})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Difficulty Rating</label>
              <select
                id="feedback-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ExerciseFeedback['difficulty'])}
                className="form-select"
              >
                <option value="too_easy" style={{ background: '#0f172a' }}>Too Easy (RPE 6-7)</option>
                <option value="just_right" style={{ background: '#0f172a' }}>Just Right (RPE 8-9)</option>
                <option value="too_hard" style={{ background: '#0f172a' }}>Too Hard / Failure</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <input
                  id="feedback-pain-checkbox"
                  type="checkbox"
                  checked={pain}
                  onChange={(e) => setPain(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#f43f5e', cursor: 'pointer' }}
                />
                <label htmlFor="feedback-pain-checkbox" style={{ fontSize: '13.5px', fontWeight: 700, color: pain ? '#f43f5e' : '#cbd5e1', cursor: 'pointer' }}>
                  ⚠️ Report Joint Pain / Injury on this Movement (Triggers Automatic AI Replacement)
                </label>
              </div>
              <textarea
                placeholder="Write specific exercise comments or injury notes (e.g. Left shoulder hurt on bench, machine unavailable, felt too heavy)..."
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={2}
                className="form-textarea"
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                id="submit-feedback-btn"
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ padding: '12px 28px', fontSize: '14px' }}
              >
                {submitting ? 'Analyzing & Swapping...' : 'Submit Feedback to AI Core'}
              </button>
            </div>
          </form>

          {feedbackResult && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '12px',
                background: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                border: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
                color: feedbackResult.includes('Adjusted') || feedbackResult.includes('Swapped') ? '#fbbf24' : '#34d399',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {feedbackResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanView;
```

Note the InBody Composition Telemetry ribbon (hardcoded SMM/body-fat/BMR/flags numbers in the original file) is intentionally dropped here — it was equally fake mock data, out of scope for this plan, and not mentioned in the spec. Leave a note for the user that it still needs real InBody data wired in separately if they want it back.

- [ ] **Step 2: Verify the build type-checks**

Run: `cd tamreena-web/frontend && npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Manual verification in the browser**

1. Ensure the `tamreena-workout-api` container is running with Task 4's change (`docker compose up -d --build api` in `Tamrena-Workout` if not already done).
2. Open `http://localhost:5174`, log in, generate a fresh AI workout plan through the intake flow (or navigate to an existing session's plan page).
3. Confirm the table shows the ACTUAL exercises from the generated plan (compare against the raw-text accordion — they must match), not the old mock names (Incline Dumbbell Press / Flat Barbell Bench Press / etc. as a fixed Day 1-4 set).
4. Submit feedback with "Report Joint Pain" checked on one exercise; confirm the response shows a swap, and the table updates to show the new exercise with an "⚡ AI Replaced" badge.
5. Reload the page. Confirm the badge is STILL there (this is the actual regression test for the "persists across refresh" requirement — the old implementation would lose it here).

- [ ] **Step 4: Commit**

```bash
cd "tamreena-web"
git add frontend/src/pages/workout/PlanView.tsx
git commit -m "fix: render the real generated plan instead of a hardcoded mock"
```

---

### Task 7: Add the CV live-session report proxy route

**Files:**
- Modify: `tamreena-web/backend/app/live_session/routes.py`
- Test: Modify `tamreena-web/backend/tests/test_live_session_routes.py` (existing)

**Interfaces:**
- Consumes: existing `call_upstream`, `proxy_json` from `app.tamreena_client`; `CV_API_URL` from `app.config`.
- Produces: `GET /api/live-session/report/{session_id}` — consumed by Task 9 (frontend fetch).

- [ ] **Step 1: Write the failing tests**

Add to `tamreena-web/backend/tests/test_live_session_routes.py` (append at the end of the file):

```python
@respx.mock
def test_get_report_forwards_to_cv_sessions_endpoint():
    route = respx.get(f"{CV_API_URL}/api/sessions/abc123").mock(
        return_value=Response(200, json={
            "summary": {"total_reps": 8, "good_reps": 6, "bad_reps": 2, "score": 82},
            "history": [{"number": 1, "score": 90, "good": True}],
            "rules": [],
        })
    )
    client = _client()
    r = client.get("/api/live-session/report/abc123", headers=_auth_header())
    assert r.status_code == 200
    assert r.json()["summary"]["total_reps"] == 8
    assert route.called


@respx.mock
def test_get_report_passes_through_404_from_cv():
    respx.get(f"{CV_API_URL}/api/sessions/missing").mock(
        return_value=Response(404, json={"detail": "Unknown session 'missing'"})
    )
    client = _client()
    r = client.get("/api/live-session/report/missing", headers=_auth_header())
    assert r.status_code == 404


def test_get_report_rejects_missing_bff_token():
    client = _client()
    r = client.get("/api/live-session/report/abc123")
    assert r.status_code in (401, 403)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tamreena-web/backend && python -m pytest tests/test_live_session_routes.py -v`
Expected: FAIL with 404 (route doesn't exist yet — `TestClient` returns 404 for an undefined path).

- [ ] **Step 3: Implement the route**

Add to `app/live_session/routes.py`, directly below the existing `upload_live_session_video` route (before `class LiveSessionResultRequest`):

```python
@router.get("/report/{session_id}")
async def get_live_session_report(session_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", f"/api/sessions/{session_id}", token=None, base_url=CV_API_URL)
    return proxy_json(resp)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tamreena-web/backend && python -m pytest tests/test_live_session_routes.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd tamreena-web/backend && python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "tamreena-web"
git add backend/app/live_session/routes.py backend/tests/test_live_session_routes.py
git commit -m "feat: proxy CV's session report through live-session/report/{id}"
```

---

### Task 8: Thread `cv_session_id` through the result-save route

**Files:**
- Modify: `tamreena-web/backend/app/live_session/routes.py`
- Test: Modify `tamreena-web/backend/tests/test_live_session_routes.py` (existing)

**Interfaces:**
- Produces: `LiveSessionResultRequest.cv_session_id: Optional[str]`, stored on the DynamoDB item — forward-compatible plumbing for a future history view (not read back anywhere in this plan).

- [ ] **Step 1: Write the failing test**

Add to `tamreena-web/backend/tests/test_live_session_routes.py` (append after `test_save_result_persists_and_returns_item`):

```python
def test_save_result_persists_cv_session_id_when_provided(dynamo_table):
    client = _client()
    body = {
        "exercise_id": "biceps_curl", "exercise_name": "Biceps Curl",
        "reps": 8, "good": 6, "bad": 2, "cv_session_id": "cv-abc123",
    }
    r = client.post("/api/live-session/result", json=body, headers=_auth_header())
    assert r.status_code == 200
    result = r.json()

    table = dynamo_table.Table(LIVE_SESSIONS_TABLE_NAME)
    stored = table.get_item(Key={"session_id": result["session_id"]}).get("Item")
    assert stored["cv_session_id"] == "cv-abc123"


def test_save_result_cv_session_id_defaults_to_none(dynamo_table):
    client = _client()
    body = {"exercise_id": "x", "exercise_name": "X", "reps": 0, "good": 0, "bad": 0}
    r = client.post("/api/live-session/result", json=body, headers=_auth_header())
    result = r.json()

    table = dynamo_table.Table(LIVE_SESSIONS_TABLE_NAME)
    stored = table.get_item(Key={"session_id": result["session_id"]}).get("Item")
    assert stored.get("cv_session_id") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tamreena-web/backend && python -m pytest tests/test_live_session_routes.py -v`
Expected: FAIL with `KeyError: 'cv_session_id'` (field doesn't exist on the stored item yet).

- [ ] **Step 3: Implement the field**

In `app/live_session/routes.py`, modify `LiveSessionResultRequest`:

```python
class LiveSessionResultRequest(BaseModel):
    exercise_id: str
    exercise_name: str
    reps: int
    good: int
    bad: int
    cv_session_id: Optional[str] = None
```

Modify `save_live_session_result`'s `item` dict:

```python
    item = {
        "session_id": session_id,
        "exercise_id": body.exercise_id,
        "exercise_name": body.exercise_name,
        "reps": body.reps,
        "good": body.good,
        "bad": body.bad,
        "cv_session_id": body.cv_session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tamreena-web/backend && python -m pytest tests/test_live_session_routes.py -v`
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `cd tamreena-web/backend && python -m pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "tamreena-web"
git add backend/app/live_session/routes.py backend/tests/test_live_session_routes.py
git commit -m "feat: persist cv_session_id alongside saved live-session results"
```

---

### Task 9: Add `recharts`, frontend types, and `getLiveSessionReport`

**Files:**
- Modify: `tamreena-web/frontend/package.json`
- Modify: `tamreena-web/frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `CvSessionReport` type, `getLiveSessionReport(sessionId: string): Promise<CvSessionReport>` — consumed by Task 10.

- [ ] **Step 1: Add the `recharts` dependency**

Run: `cd tamreena-web/frontend && npm install recharts`
Expected: `package.json`'s `dependencies` gains a `"recharts"` entry; `package-lock.json` updates.

- [ ] **Step 2: Add the report types and fetch function to `lib/api.ts`**

Append to `frontend/src/lib/api.ts`:

```typescript
export interface CvRepetition {
  number: number;
  good: boolean;
  score: number;
}

export interface CvRuleDefinition {
  name: string;
  severity: string;
  message: string;
}

export interface CvSessionSummary {
  total_reps: number;
  good_reps: number;
  bad_reps: number;
  accuracy: number;
  score: number | null;
  common_errors: Record<string, number>;
  most_common_error: string | null;
}

export interface CvSessionReport {
  summary: CvSessionSummary;
  history: CvRepetition[];
  rules: CvRuleDefinition[];
}

export async function getLiveSessionReport(cvSessionId: string): Promise<CvSessionReport> {
  const res = await authFetch(`/api/live-session/report/${cvSessionId}`);
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to load report (${res.status})`));
  return res.json();
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd tamreena-web/frontend && npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
cd "tamreena-web"
git add frontend/package.json frontend/package-lock.json frontend/src/lib/api.ts
git commit -m "feat: add recharts and getLiveSessionReport for the CV report view"
```

---

### Task 10: Render the score graph + mistakes summary on session completion

**Files:**
- Create: `tamreena-web/frontend/src/pages/live-session/SessionReportView.tsx`
- Modify: `tamreena-web/frontend/src/pages/live-session/LiveSession.tsx`

**Interfaces:**
- Consumes: `CvSessionReport`, `getLiveSessionReport` (Task 9).

- [ ] **Step 1: Create `SessionReportView.tsx`**

```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CvSessionReport } from '../../lib/api';

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: { good: boolean };
}

function VerdictDot({ cx = 0, cy = 0, payload }: DotProps) {
  return <circle cx={cx} cy={cy} r={4} fill={payload?.good ? '#34d399' : '#f43f5e'} stroke="#0f172a" strokeWidth={1.5} />;
}

/**
 * Renders the CV engine's own report (score-per-rep + rule-failure
 * breakdown) on the tamreena-web completion screen — previously only
 * reps/good/bad were shown, even though the same data this uses was
 * already available in the standalone Computer-Vision app.
 */
function SessionReportView({ report }: { report: CvSessionReport }) {
  const points = report.history.map((r) => ({ rep: r.number, score: r.score, good: r.good }));
  const errorEntries = Object.entries(report.summary.common_errors);
  const ruleByName = new Map(report.rules.map((r) => [r.name, r]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
      <div className="glass-panel" style={{ padding: '20px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
          Score Per Repetition
        </span>
        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="rep" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `#${v}`} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={<VerdictDot />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
          Mistakes
        </span>
        {errorEntries.length === 0 ? (
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: 0 }}>Perfect form — nothing failed.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {errorEntries.map(([rule, count]) => (
              <div key={rule} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{rule}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{count}×</span>
                </div>
                {ruleByName.get(rule)?.message && (
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{ruleByName.get(rule)!.message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionReportView;
```

- [ ] **Step 2: Wire it into `LiveSession.tsx`**

In `frontend/src/pages/live-session/LiveSession.tsx`:

Add to the imports:

```typescript
import {
  getLiveSessionWebSocketUrl,
  getLiveSessionReport,
  saveLiveSessionResult,
  uploadLiveSessionVideo,
  type CvExercise,
  type CvSessionReport,
} from '../../lib/api';
import SessionReportView from './SessionReportView';
```

Add state (alongside the existing `result` state):

```typescript
  const [cvSessionId, setCvSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<CvSessionReport | null>(null);
```

In `startLiveSession`'s `ws.onmessage` handler, in the `data.type === 'end'` branch, capture the id before calling `finishSession` — change:

```typescript
        } else if (data.type === 'end') {
          wsRef.current = null;
          ws.close();
          const current = liveStateRef.current;
          finishSession(data.reps ?? current.reps, current.good, current.bad);
```

to:

```typescript
        } else if (data.type === 'end') {
          wsRef.current = null;
          ws.close();
          const current = liveStateRef.current;
          finishSession(data.reps ?? current.reps, current.good, current.bad, data.session_id ?? null);
```

Update `finishSession`'s signature and body — change:

```typescript
  const finishSession = async (reps: number, good: number, bad: number) => {
    try {
      await saveLiveSessionResult(exercise.id, exercise.name, reps, good, bad);
    } catch (err) {
      console.error('Failed to save live session result', err);
    }
    setResult({ reps, good, bad });
    setPhase('complete');
  };
```

to:

```typescript
  const finishSession = async (reps: number, good: number, bad: number, sessionId: string | null) => {
    try {
      await saveLiveSessionResult(exercise.id, exercise.name, reps, good, bad, sessionId ?? undefined);
    } catch (err) {
      console.error('Failed to save live session result', err);
    }
    setResult({ reps, good, bad });
    setCvSessionId(sessionId);
    setPhase('complete');

    if (sessionId) {
      getLiveSessionReport(sessionId)
        .then(setReport)
        .catch((err) => {
          // Report fetch failure must never block the completion screen —
          // the plain reps/good/bad tally (already set above) stays valid.
          console.error('Failed to load session report', err);
        });
    }
  };
```

Update `handleRetry` to also reset the new state — add these two lines alongside the existing resets (after `setResult(null);`):

```typescript
    setCvSessionId(null);
    setReport(null);
```

In the `phase === 'complete'` JSX block, render the report view right after the existing three-stat grid and before the "Return to Exercise Directory" link:

```tsx
            {report && <SessionReportView report={report} />}

            <a href="/exercises" id="live-session-back-link" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: '20px' }}>
```

(This replaces the existing `<a href="/exercises" ...>` opening tag — just adding the `report &&` block immediately before it and a `marginTop` so it doesn't sit flush against the report cards above when present.)

- [ ] **Step 3: Update `saveLiveSessionResult`'s signature in `lib/api.ts`**

In `frontend/src/lib/api.ts`, replace:

```typescript
export async function saveLiveSessionResult(
  exerciseId: string,
  exerciseName: string,
  reps: number,
  good: number,
  bad: number,
): Promise<LiveSessionResult> {
  const res = await authFetch('/api/live-session/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise_id: exerciseId, exercise_name: exerciseName, reps, good, bad }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to save session result (${res.status})`));
  return res.json();
}
```

with:

```typescript
export async function saveLiveSessionResult(
  exerciseId: string,
  exerciseName: string,
  reps: number,
  good: number,
  bad: number,
  cvSessionId?: string,
): Promise<LiveSessionResult> {
  const res = await authFetch('/api/live-session/result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exercise_id: exerciseId, exercise_name: exerciseName, reps, good, bad,
      cv_session_id: cvSessionId ?? null,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, `Failed to save session result (${res.status})`));
  return res.json();
}
```

- [ ] **Step 4: Verify the build type-checks**

Run: `cd tamreena-web/frontend && npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 5: Manual verification**

1. Ensure `tamreena-web-backend` is rebuilt with Tasks 7-8 (`docker compose up -d --build backend` in `tamreena-web`).
2. Run a live CV session end-to-end through `http://localhost:5174/exercises` → pick a CV-supported exercise → Launch Live Form Tracking Session → upload a real workout video (needed since live webcam capture isn't available in this Docker setup, per earlier findings this session) → let it run to completion.
3. Confirm the completion screen now shows a score-per-rep line chart and a mistakes list below the existing rep/good/bad tally, not just the tally alone.
4. If no report loads (e.g. `EXPORT_SESSION` was off, or the CV run errored before assigning an id), confirm the screen still shows the plain tally without erroring — check the browser console for the expected "Failed to load session report" log rather than an uncaught exception.

- [ ] **Step 6: Commit**

```bash
cd "tamreena-web"
git add frontend/src/pages/live-session/SessionReportView.tsx frontend/src/pages/live-session/LiveSession.tsx frontend/src/lib/api.ts
git commit -m "feat: show CV score graph and mistakes summary on session completion"
```
