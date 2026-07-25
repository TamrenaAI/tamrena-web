"""
Tests for app/db.py — ensure_indexes() index management.
Regression coverage for stale Google-auth index cleanup.
"""

import pytest
from pymongo.errors import OperationFailure

import app.db as db_module


def test_ensure_indexes_drops_stale_google_auth_indexes(mongo_db):
    """
    Verify ensure_indexes() safely drops stale google_sub_1 and email_1
    unique indexes from old Google-auth schema, preventing DuplicateKeyError
    collisions on implicit null values. Simulates a database migrated from
    the old schema.
    """
    db = mongo_db[db_module.MONGO_DB_NAME]

    # Create stale indexes matching the old Google-auth schema.
    # These are the exact index names that Stage 1 used.
    db.users.create_index("google_sub", unique=True)
    db.users.create_index("email", unique=True)

    # Verify stale indexes exist before cleanup.
    indexes_before = db.users.index_information()
    assert "google_sub_1" in indexes_before
    assert "email_1" in indexes_before

    # Call ensure_indexes() — should drop stale indexes and create username index.
    db_module.ensure_indexes()

    # Verify stale indexes are gone.
    indexes_after = db.users.index_information()
    assert "google_sub_1" not in indexes_after
    assert "email_1" not in indexes_after

    # Verify username_1 exists and is unique.
    assert "username_1" in indexes_after
    assert indexes_after["username_1"]["unique"] is True

    # Now that stale indexes are dropped, we can insert multiple docs without
    # google_sub/email fields (they would implicitly be null), which would have
    # caused DuplicateKeyError collisions on the old schema.
    db.users.insert_one({"username": "user1", "password_hash": "hash1"})
    db.users.insert_one({"username": "user2", "password_hash": "hash2"})


def test_ensure_indexes_is_idempotent_with_no_stale_indexes(mongo_db):
    """
    Verify ensure_indexes() is idempotent: calling it twice on a fresh
    database with no stale indexes doesn't raise and leaves username_1 intact.
    This proves the IndexNotFound exception handling is safe.
    """
    db = mongo_db[db_module.MONGO_DB_NAME]

    # First call — creates username_1.
    db_module.ensure_indexes()
    indexes_after_first = db.users.index_information()
    assert "username_1" in indexes_after_first
    assert indexes_after_first["username_1"]["unique"] is True

    # Second call — should not raise, even though stale indexes don't exist.
    db_module.ensure_indexes()
    indexes_after_second = db.users.index_information()
    assert "username_1" in indexes_after_second
    assert indexes_after_second["username_1"]["unique"] is True

    # Verify indexes are identical.
    assert indexes_after_first == indexes_after_second
