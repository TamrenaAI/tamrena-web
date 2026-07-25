"""
One-off migration: copy every user from the BFF's old Mongo `users`
collection into the new `workout_users` DynamoDB table.

Run once, after Task 1-8 are deployed and before decommissioning Mongo, from
the `backend/` directory (needed so `app` is importable):
    PYTHONPATH=. python scripts/migrate_users_to_dynamodb.py

Requires `pymongo` to be installed (`pip install pymongo`) — it is
intentionally not in requirements.txt since this is a one-shot operational
script, not part of the running service.

Requires MONGO_URI (pointing at the OLD database, read-only for this
script) and the usual AWS_REGION/DYNAMODB_TABLE_NAME/credentials the app
itself uses. Idempotent: skips any user_id that already exists in Dynamo,
so it's safe to re-run if it's interrupted partway through.
"""

import os
from datetime import timezone

from pymongo import MongoClient

from app.db import get_users_table

MONGO_URI = os.environ["MONGO_URI"]  # explicit — this script must never silently no-op
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "tamreena_web")


def migrate() -> None:
    mongo_users = MongoClient(MONGO_URI)[MONGO_DB_NAME].users
    table = get_users_table()

    migrated = 0
    skipped = 0
    malformed = 0
    for doc in mongo_users.find({}):
        # Old Mongo _id becomes the new user_id — preserves any external
        # references (e.g. JWTs already issued with the old id as `sub`).
        user_id = str(doc["_id"])

        # Records from the pre-username/password schema (Google Sign-In:
        # google_sub/email/name, no username/password_hash) have no home in
        # the new table — skip rather than crash, so one legacy leftover
        # doesn't block migrating every valid user behind it.
        if "username" not in doc or "password_hash" not in doc:
            print(f"Skipping malformed doc {user_id} (missing username/password_hash): {doc}")
            malformed += 1
            continue

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

    print(f"Migrated {migrated} users, skipped {skipped} already present, {malformed} malformed/legacy skipped.")


if __name__ == "__main__":
    migrate()
