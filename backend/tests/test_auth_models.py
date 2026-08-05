"""
Tests for app/auth/models.py — create_user, verify_password, get_user_by_username.
"""

import pytest
from uuid import uuid4

from app.auth import models


def test_create_user_returns_public_shape():
    user = models.create_user(username="TestUser", password="supersecret1")
    assert user["username"] == "testuser"  # normalized to lowercase
    assert "password" not in user
    assert "password_hash" not in user
    # id must be 24 hex chars — structurally valid as a MongoDB ObjectId
    # string, since Tamreena_AI parses the JWT subject as bson.ObjectId(sub).
    assert len(user["id"]) == 24
    int(user["id"], 16)  # raises ValueError if not valid hex


def test_create_user_rejects_duplicate_username_case_insensitive():
    models.create_user(username="DupeUser", password="supersecret1")
    with pytest.raises(ValueError):
        models.create_user(username="dupeuser", password="anotherpass1")


def test_verify_password_succeeds_with_correct_credentials():
    models.create_user(username="verifyuser", password="correctpass1")
    result = models.verify_password(username="verifyuser", password="correctpass1")
    assert result is not None
    assert result["username"] == "verifyuser"


def test_verify_password_is_case_insensitive_on_username():
    models.create_user(username="CaseUser", password="correctpass1")
    result = models.verify_password(username="CASEUSER", password="correctpass1")
    assert result is not None


def test_verify_password_fails_with_wrong_password():
    models.create_user(username="wrongpassuser", password="correctpass1")
    result = models.verify_password(username="wrongpassuser", password="wrongpass1")
    assert result is None


def test_verify_password_fails_with_unknown_username():
    result = models.verify_password(username="nosuchuser", password="whatever1")
    assert result is None


def test_get_user_by_id_returns_none_for_unknown_id():
    assert models.get_user_by_id(str(uuid4())) is None


def test_get_user_by_id_returns_none_for_nonexistent_string_id():
    # DynamoDB has no ID-format validation (unlike Mongo's ObjectId) — any
    # string that doesn't match a stored user_id simply isn't found.
    assert models.get_user_by_id("not-a-real-id") is None


def test_get_user_by_id_returns_none_for_malformed_input():
    # Empty string / non-string input used to hit DynamoDB directly and
    # raise a raw botocore ValidationException instead of degrading to None
    # the way the old Mongo version did (via InvalidId).
    assert models.get_user_by_id("") is None
    assert models.get_user_by_id(None) is None


def test_set_and_get_last_nutrition_run_id():
    user = models.create_user(username="nutritionuser", password="supersecret1")
    assert models.get_last_nutrition_run_id(user["id"]) is None

    models.set_last_nutrition_run_id(user["id"], "run-abc123")
    assert models.get_last_nutrition_run_id(user["id"]) == "run-abc123"


def test_set_last_nutrition_run_id_overwrites_previous_value():
    user = models.create_user(username="nutritionuser2", password="supersecret1")
    models.set_last_nutrition_run_id(user["id"], "run-first")
    models.set_last_nutrition_run_id(user["id"], "run-second")
    assert models.get_last_nutrition_run_id(user["id"]) == "run-second"


def test_get_last_nutrition_run_id_returns_none_for_unknown_user():
    assert models.get_last_nutrition_run_id("does-not-exist") is None
