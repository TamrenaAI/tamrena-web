# Workout-Users DynamoDB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the BFF's user storage from its own MongoDB `users` collection to the already-provisioned `workout_users` DynamoDB table, with zero behavior change to signup/login/`/auth/me`.

**Architecture:** `app/db.py` swaps its Mongo client for a boto3 DynamoDB resource. `app/auth/models.py`'s four functions (`get_user_by_id`, `get_user_by_username`, `create_user`, `verify_password`) are rewritten against DynamoDB but keep their exact signatures and return shapes, so `auth/dependencies.py` and `auth/routes.py` need no changes at all. Tests swap `mongomock` for `moto` (AWS mocking).

**Tech Stack:** boto3 (DynamoDB), moto (test mocking), bcrypt (unchanged), FastAPI (unchanged).

## Global Constraints

- This is Phase 1 of `Tamreena_AI/docs/superpowers/specs/2026-07-25-dynamodb-single-datastore-design.md` — scope is the `workout_users` table only. `plan_sessions` and the other 7 workout-agent tables are separate, later plans.
- Table name: `workout_users`, PK: `user_id` (String). Region: `eu-north-1` (matches the existing ECR/ECS setup).
- GSI must be named `username-index`, keyed on `username` (String) — **not** `google_sub-index` as originally provisioned; Task 1 below is fixing that in AWS before any code lands.
- No behavior change: same validation errors, same case-insensitive username handling, same public user shape (`id`/`username`/`created_at`).
- `user_id` becomes an app-generated UUID4 string (Dynamo has no Mongo-style auto `_id`) instead of a Mongo `ObjectId`.

---

### Task 1: Fix the DynamoDB GSI in AWS (manual, not code)

**Files:** none — this is an AWS Console/CLI step.

- [ ] **Step 1: Delete the existing `google_sub-index` GSI** on the `workout_users` table (DynamoDB console → table → Indexes tab → select `google_sub-index` → Delete).
- [ ] **Step 2: Create a new GSI named `username-index`**, partition key `username` (String), same read/write capacity mode as the table (on-demand or provisioned — match whatever the table already uses).
- [ ] **Step 3: Wait for the GSI status to become `Active`** before moving to Task 2 (deleting+creating a GSI is asynchronous and can take a few minutes on a populated table — this one is empty, so it should be fast).

---

### Task 2: Swap Mongo for boto3/moto in dependencies

**Files:**
- Modify: `tamreena-web/backend/requirements.txt`

**Interfaces:**
- Produces: `boto3` and `moto` available for Task 3+ to import.

- [ ] **Step 1: Edit `requirements.txt`**

```
fastapi
uvicorn[standard]
boto3
pyjwt
bcrypt
python-dotenv
pydantic
pytest
moto[dynamodb]
httpx
```

(Removed `pymongo` and `mongomock` — nothing in this repo uses Mongo after this plan; added `boto3` and `moto[dynamodb]`.)

- [ ] **Step 2: Install and verify**

Run: `cd tamreena-web/backend && pip install -r requirements.txt`
Expected: installs cleanly, no dependency conflicts.

- [ ] **Step 3: Commit**

```bash
git add tamreena-web/backend/requirements.txt
git commit -m "chore: swap pymongo/mongomock for boto3/moto"
```

---

### Task 3: Rewrite `app/config.py` for DynamoDB settings

**Files:**
- Modify: `tamreena-web/backend/app/config.py`

**Interfaces:**
- Produces: `AWS_REGION: str`, `DYNAMODB_TABLE_NAME: str` — consumed by Task 4's `app/db.py`.

- [ ] **Step 1: Replace the Mongo section with DynamoDB settings**

```python
"""
Central configuration for the Tamreena Web BFF — environment loading.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

# ── DynamoDB (this service's OWN table, never Tamreena_AI's) ──────────
AWS_REGION = os.getenv("AWS_REGION", "eu-north-1")
DYNAMODB_TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "workout_users")

# ── Auth ──────────────────────────────────────────────────────────────
# JWT_SECRET MUST match Tamreena_AI's own JWT_SECRET exactly — tokens
# minted here are verified by that repo's API using this same secret.
# See Tamreena_AI/docs/superpowers/specs/2026-07-25-bff-auth-handoff-design.md.
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days, matches Tamreena_AI's own token lifetime
```

- [ ] **Step 2: Update `.env.example`** to replace `MONGO_URI`/`MONGO_DB_NAME` with `AWS_REGION=eu-north-1` and `DYNAMODB_TABLE_NAME=workout_users`.

- [ ] **Step 3: Commit**

```bash
git add tamreena-web/backend/app/config.py tamreena-web/backend/.env.example
git commit -m "feat: replace Mongo config with DynamoDB settings"
```

---

### Task 4: Rewrite `app/db.py` as a boto3 resource accessor

**Files:**
- Modify: `tamreena-web/backend/app/db.py`
- Test: `tamreena-web/backend/tests/test_db.py` (full rewrite — old tests covered Mongo stale-index cleanup, which no longer applies)

**Interfaces:**
- Consumes: `AWS_REGION`, `DYNAMODB_TABLE_NAME` from `app.config` (Task 3).
- Produces: `get_resource() -> boto3 DynamoDB ServiceResource`, `get_users_table() -> boto3 Table` — consumed by Task 5's `app/auth/models.py` and Task 6's `app/main.py`.

- [ ] **Step 1: Write the failing test** (replace the whole file)

```python
"""
Tests for app/db.py — DynamoDB resource/table access.
"""

import app.db as db_module


def test_get_users_table_returns_table_with_configured_name():
    table = db_module.get_users_table()
    assert table.table_name == db_module.DYNAMODB_TABLE_NAME


def test_get_resource_is_cached_across_calls():
    first = db_module.get_resource()
    second = db_module.get_resource()
    assert first is second
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tamreena-web/backend && pytest tests/test_db.py -v`
Expected: FAIL — `app.db` still has the old Mongo `get_client`/`get_db`/`ensure_indexes`, not `get_resource`/`get_users_table`/`DYNAMODB_TABLE_NAME`.

- [ ] **Step 3: Write minimal implementation** (replace the whole file)

```python
"""
Shared DynamoDB client — this service's OWN table, never Tamreena_AI's.
"""

from typing import Optional

import boto3

from app.config import AWS_REGION, DYNAMODB_TABLE_NAME

_resource: Optional["boto3.resources.base.ServiceResource"] = None


def get_resource():
    global _resource
    if _resource is None:
        _resource = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _resource


def get_users_table():
    return get_resource().Table(DYNAMODB_TABLE_NAME)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tamreena-web/backend && pytest tests/test_db.py -v`
Expected: still FAIL at this point — there's no moto mock yet, so `get_resource()` will try to build a real boto3 client. That's expected; Task 5's `conftest.py` rewrite provides the mock every test needs. Confirm the failure is a boto3/credentials error, not an `AttributeError` on missing functions (that would mean Step 3 has a bug).

- [ ] **Step 5: Commit**

```bash
git add tamreena-web/backend/app/db.py tamreena-web/backend/tests/test_db.py
git commit -m "feat: replace Mongo client with boto3 DynamoDB resource accessor"
```

---

### Task 5: Rewrite the test fixture for moto

**Files:**
- Modify: `tamreena-web/backend/tests/conftest.py` (full rewrite)

**Interfaces:**
- Consumes: `app.db._resource`, `app.config.AWS_REGION`, `app.config.DYNAMODB_TABLE_NAME` (Tasks 3-4).
- Produces: every test in the suite runs against an isolated in-memory DynamoDB table named `workout_users` with a `username-index` GSI — matches Task 1's real AWS schema.

- [ ] **Step 1: Replace the whole file**

```python
"""
Shared pytest fixtures. `dynamo_table` (autouse) gives every test an
isolated in-memory DynamoDB via moto, matching the real `workout_users`
table's schema (PK user_id, GSI username-index on username), so no test
ever touches the real AWS table.
"""

import boto3
import pytest
from moto import mock_aws

import app.db as db_module
from app.config import AWS_REGION, DYNAMODB_TABLE_NAME


@pytest.fixture(autouse=True)
def dynamo_table():
    with mock_aws():
        db_module._resource = None  # force get_resource() to rebuild inside the mock
        resource = boto3.resource("dynamodb", region_name=AWS_REGION)
        resource.create_table(
            TableName=DYNAMODB_TABLE_NAME,
            KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "user_id", "AttributeType": "S"},
                {"AttributeName": "username", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "username-index",
                    "KeySchema": [{"AttributeName": "username", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                    "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
                }
            ],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )
        yield resource
        db_module._resource = None  # don't leak the mock resource into the next test
```

- [ ] **Step 2: Run the full suite to confirm Task 4's tests now pass**

Run: `cd tamreena-web/backend && pytest tests/test_db.py -v`
Expected: both tests PASS now that a real (mocked) table exists.

- [ ] **Step 3: Commit**

```bash
git add tamreena-web/backend/tests/conftest.py
git commit -m "test: replace mongomock fixture with moto DynamoDB fixture"
```

---

### Task 6: Rewrite `app/auth/models.py` against DynamoDB

**Files:**
- Modify: `tamreena-web/backend/app/auth/models.py` (full rewrite)
- Test: `tamreena-web/backend/tests/test_auth_models.py` (update the two ID-format assertions only — everything else stays as-is since behavior is unchanged)

**Interfaces:**
- Consumes: `get_users_table()` from `app.db` (Task 4).
- Produces: `get_user_by_id(user_id: str) -> Optional[dict]`, `get_user_by_username(username: str) -> Optional[dict]` (raw item, includes `password_hash`), `create_user(username: str, password: str) -> dict`, `verify_password(username: str, password: str) -> Optional[dict]` — same signatures as before, consumed unchanged by `auth/dependencies.py` and `auth/routes.py`.

- [ ] **Step 1: Update the two tests whose assertions were Mongo-`ObjectId`-specific**

In `tests/test_auth_models.py`, replace:

```python
from bson import ObjectId

from app.auth import models


def test_create_user_returns_public_shape():
    user = models.create_user(username="TestUser", password="supersecret1")
    assert user["username"] == "testuser"  # normalized to lowercase
    assert "password" not in user
    assert "password_hash" not in user
    assert ObjectId.is_valid(user["id"])
```

with:

```python
from uuid import UUID

from app.auth import models


def test_create_user_returns_public_shape():
    user = models.create_user(username="TestUser", password="supersecret1")
    assert user["username"] == "testuser"  # normalized to lowercase
    assert "password" not in user
    assert "password_hash" not in user
    UUID(user["id"])  # raises ValueError if not a valid UUID4 string
```

and replace:

```python
def test_get_user_by_id_returns_none_for_unknown_id():
    assert models.get_user_by_id(str(ObjectId())) is None


def test_get_user_by_id_returns_none_for_malformed_id():
    assert models.get_user_by_id("not-an-objectid") is None
```

with:

```python
def test_get_user_by_id_returns_none_for_unknown_id():
    assert models.get_user_by_id(str(uuid4())) is None


def test_get_user_by_id_returns_none_for_nonexistent_string_id():
    # DynamoDB has no ID-format validation (unlike Mongo's ObjectId) — any
    # string that doesn't match a stored user_id simply isn't found.
    assert models.get_user_by_id("not-a-real-id") is None
```

Add `from uuid import uuid4` to the top of the file alongside the `UUID` import.

- [ ] **Step 2: Run tests to verify they fail against the still-Mongo `models.py`**

Run: `cd tamreena-web/backend && pytest tests/test_auth_models.py -v`
Expected: FAIL — `app.auth.models` still imports `from app.db import get_db`, which no longer exists.

- [ ] **Step 3: Write the implementation** (replace the whole file)

```python
"""
User accounts — this service's OWN `workout_users` DynamoDB table (see
app/db.py). Username + password is the only sign-in method. Usernames are
normalized to lowercase for storage and lookup (case-insensitive
uniqueness, no separate display-casing).
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
from boto3.dynamodb.conditions import Key

from app.db import get_users_table


def _serialize(item: dict) -> dict:
    return {
        "id": item["user_id"],
        "username": item["username"],
        "created_at": datetime.fromisoformat(item["created_at"]),
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    resp = get_users_table().get_item(Key={"user_id": user_id})
    item = resp.get("Item")
    return _serialize(item) if item else None


def get_user_by_username(username: str) -> Optional[dict]:
    """Internal use only (login needs the password_hash) — returns the raw
    DynamoDB item, not the public-safe _serialize() shape."""
    resp = get_users_table().query(
        IndexName="username-index",
        KeyConditionExpression=Key("username").eq(username.lower()),
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def create_user(username: str, password: str) -> dict:
    """Raises ValueError if the (case-insensitive) username is already taken."""
    normalized = username.lower()
    if get_user_by_username(normalized):
        raise ValueError("Username is already taken.")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    item = {
        "user_id": str(uuid4()),
        "username": normalized,
        "password_hash": password_hash.decode("utf-8"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    get_users_table().put_item(
        Item=item,
        ConditionExpression="attribute_not_exists(user_id)",
    )
    return _serialize(item)


def verify_password(username: str, password: str) -> Optional[dict]:
    """Returns the public-safe user dict if username+password match, else None."""
    item = get_user_by_username(username)
    if item is None:
        return None
    if not bcrypt.checkpw(password.encode("utf-8"), item["password_hash"].encode("utf-8")):
        return None
    return _serialize(item)
```

Note on Decision 7 from the design spec: this carries over the same check-then-write pattern
the Mongo version had (`if db.users.find_one(...): raise ValueError(...)` there vs.
`if get_user_by_username(...): raise ValueError(...)` here), but it is not the exact same race
window. The Mongo version had a unique index on `username` as a backstop, so even if two
concurrent signups both passed the find_one check, the database itself would reject the second
insert. This DynamoDB version has no such backstop — there is no unique constraint on the
`username-index` GSI — so a concurrent double-signup with the same username can both succeed at
the write, leaving two items with the same username and nondeterministic login behavior for
that username. This is accepted as a tradeoff at the current user count, not a like-for-like
carryover of the Mongo behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd tamreena-web/backend && pytest tests/test_auth_models.py -v`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tamreena-web/backend/app/auth/models.py tamreena-web/backend/tests/test_auth_models.py
git commit -m "feat: rewrite auth/models.py against DynamoDB"
```

---

### Task 7: Fix the one remaining `bson.ObjectId` usage outside models.py

**Files:**
- Modify: `tamreena-web/backend/tests/test_cross_repo_secret.py`

**Interfaces:** none (test-only change, no production code touches this).

- [ ] **Step 1: Replace the fake-ID generator**

Find:
```python
from bson import ObjectId
```
and:
```python
    token = tokens.create_access_token(user_id=str(ObjectId()))
```

Replace with:
```python
from uuid import uuid4
```
and:
```python
    token = tokens.create_access_token(user_id=str(uuid4()))
```

(`bson` was only ever used here as a convenient random-ID generator, unrelated to storage — `pymongo`/`bson` is no longer a dependency after Task 2, so this import would otherwise break.)

- [ ] **Step 2: Run test to verify it still passes**

Run: `cd tamreena-web/backend && pytest tests/test_cross_repo_secret.py -v`
Expected: PASS (this test never depended on Mongo storage, only on `tokens.create_access_token` accepting any string).

- [ ] **Step 3: Commit**

```bash
git add tamreena-web/backend/tests/test_cross_repo_secret.py
git commit -m "test: replace bson.ObjectId fake-id generator with uuid4"
```

---

### Task 8: Update `app/main.py`'s startup fail-fast check

**Files:**
- Modify: `tamreena-web/backend/app/main.py:14-22` (the `lifespan` function)

**Interfaces:**
- Consumes: `get_users_table()` from `app.db` (Task 4).

- [ ] **Step 1: Replace `ensure_indexes()` with a DynamoDB reachability check**

Find:
```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_indexes()

    from app.config import JWT_SECRET
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — the service cannot issue or verify sessions without it.")

    yield
```

Replace with:
```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.config import DYNAMODB_TABLE_NAME, JWT_SECRET

    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — the service cannot issue or verify sessions without it.")

    table = get_users_table()
    table.load()  # raises botocore.exceptions.ClientError if the table doesn't exist/isn't reachable
    if table.table_status != "ACTIVE":
        raise RuntimeError(f"DynamoDB table '{DYNAMODB_TABLE_NAME}' is not ACTIVE (status: {table.table_status}).")

    yield
```

Also update the top-of-file import: remove `from app.db import ensure_indexes` (if present) and add `from app.db import get_users_table`.

- [ ] **Step 2: Add a test for the fail-fast behavior**

Create/append to `tamreena-web/backend/tests/test_main.py`:

```python
"""
Tests for app/main.py — startup fail-fast behavior.
"""

import pytest
from fastapi.testclient import TestClient


def test_app_starts_successfully_with_valid_table_and_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    import importlib
    import app.main as main_module
    importlib.reload(main_module)

    with TestClient(main_module.app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd tamreena-web/backend && pytest tests/test_main.py -v`
Expected: PASS — the `dynamo_table` autouse fixture (Task 5) already provides an ACTIVE mocked table, so startup succeeds.

- [ ] **Step 4: Commit**

```bash
git add tamreena-web/backend/app/main.py tamreena-web/backend/tests/test_main.py
git commit -m "feat: fail-fast on DynamoDB table reachability instead of Mongo index setup"
```

---

### Task 9: One-off data migration script (Mongo → DynamoDB)

**Files:**
- Create: `tamreena-web/backend/scripts/migrate_users_to_dynamodb.py`

**Interfaces:** standalone script, run once manually — not imported by app code.

- [ ] **Step 1: Write the script**

```python
"""
One-off migration: copy every user from the BFF's old Mongo `users`
collection into the new `workout_users` DynamoDB table.

Run once, after Task 1-8 are deployed and before decommissioning Mongo:
    python scripts/migrate_users_to_dynamodb.py

Requires MONGO_URI (pointing at the OLD database, read-only for this
script) and the usual AWS_REGION/DYNAMODB_TABLE_NAME/credentials the app
itself uses. Idempotent: skips any user_id that already exists in Dynamo,
so it's safe to re-run if it's interrupted partway through.
"""

import os
from datetime import timezone
from uuid import uuid4

from pymongo import MongoClient

from app.db import get_users_table

MONGO_URI = os.environ["MONGO_URI"]  # explicit — this script must never silently no-op
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "tamreena_web")


def migrate() -> None:
    mongo_users = MongoClient(MONGO_URI)[MONGO_DB_NAME].users
    table = get_users_table()

    migrated = 0
    skipped = 0
    for doc in mongo_users.find({}):
        # Old Mongo _id becomes the new user_id — preserves any external
        # references (e.g. JWTs already issued with the old id as `sub`).
        user_id = str(doc["_id"])

        existing = table.get_item(Key={"user_id": user_id}).get("Item")
        if existing:
            skipped += 1
            continue

        created_at = doc["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        table.put_item(Item={
            "user_id": user_id,
            "username": doc["username"],
            "password_hash": doc["password_hash"].decode("utf-8")
                if isinstance(doc["password_hash"], bytes) else doc["password_hash"],
            "created_at": created_at.isoformat(),
        })
        migrated += 1

    print(f"Migrated {migrated} users, skipped {skipped} already present.")


if __name__ == "__main__":
    migrate()
```

Note: this script needs `pymongo` at run time even though it's no longer in `requirements.txt`
(Task 2 removed it as an app dependency). Install it ad hoc for this one run:
`pip install pymongo`, or keep it in a separate `scripts/requirements.txt` — either is fine,
this is a one-time operational script, not part of the deployed service.

- [ ] **Step 2: Dry-run against local data**

Run: `cd tamreena-web/backend && MONGO_URI=mongodb://localhost:27018 AWS_REGION=eu-north-1 DYNAMODB_TABLE_NAME=workout_users python scripts/migrate_users_to_dynamodb.py`
Expected: prints a migrated/skipped count matching whatever test users exist locally; verify manually via `aws dynamodb scan --table-name workout_users` that the rows landed correctly.

- [ ] **Step 3: Commit**

```bash
git add tamreena-web/backend/scripts/migrate_users_to_dynamodb.py
git commit -m "feat: add one-off Mongo-to-DynamoDB user migration script"
```

---

### Task 10: Remove Mongo entirely from this service's runtime

**Files:**
- Modify: `tamreena-web/docker-compose.yml` (remove the `mongo` service and `backend`'s `MONGO_URI` env var / `depends_on: mongo`, if present)
- Modify: `tamreena-web/backend/.env` / `.env.example` (remove `MONGO_URI`/`MONGO_DB_NAME` if still present after Task 3)

**Interfaces:** none — cleanup only, no behavior change (Mongo is already unused after Task 6).

- [ ] **Step 1: Grep for any remaining Mongo references**

Run: `cd tamreena-web && grep -rn "MONGO_URI\|pymongo\|mongomock\|MongoClient" backend/ docker-compose.yml`
Expected: only `scripts/migrate_users_to_dynamodb.py` (Task 9, intentionally still Mongo-aware for the one-time migration) should appear.

- [ ] **Step 2: Remove the `mongo` service block from `docker-compose.yml`** and any `backend` env vars / `depends_on` entries referencing it.

- [ ] **Step 3: Bring the stack up locally and smoke-test**

Run: `cd tamreena-web && docker compose up --build`
Then: `curl -X POST http://localhost:8010/auth/signup -H "Content-Type: application/json" -d '{"username":"smoketest","password":"testpass123","confirm_password":"testpass123"}'`
Expected: `201` with an `access_token` in the response — full signup flow works against real (or your dev AWS) DynamoDB with no Mongo container running at all.

- [ ] **Step 4: Commit**

```bash
git add tamreena-web/docker-compose.yml tamreena-web/backend/.env.example
git commit -m "chore: remove Mongo service and config now that users live in DynamoDB"
```

---

## Self-Review Notes

- **Spec coverage:** Decisions 1 (GSI fix), 4 (JWT reuse — N/A here, no cross-service call exists
  yet in Phase 1; this table is only read/written by the BFF itself), 6 (UUID ids), and 7
  (check-then-write uniqueness) are all covered. Decisions 2, 3, 5 apply to later phases
  (`plan_sessions` etc.), not this one.
- **Out of scope reminder:** this plan does NOT touch `Tamreena_AI`/workout-agent at all — it has
  no user storage of its own to migrate (per the earlier BFF-auth-handoff spec). Phase 2
  (`plan_sessions` + `exercises`) is where workout-agent code starts changing.
