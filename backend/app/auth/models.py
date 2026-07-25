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
