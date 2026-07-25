"""
User accounts — this service's OWN `users` collection (see app/db.py).
Username + password is the only sign-in method. Usernames are normalized
to lowercase for storage and lookup (case-insensitive uniqueness, no
separate display-casing).
"""

from datetime import datetime, timezone
from typing import Optional

import bcrypt
from bson import ObjectId
from bson.errors import InvalidId

from app.db import get_db


def _serialize(doc: dict) -> dict:
    created_at = doc["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "id": str(doc["_id"]),
        "username": doc["username"],
        "created_at": created_at,
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        return None
    doc = get_db().users.find_one({"_id": oid})
    return _serialize(doc) if doc else None


def get_user_by_username(username: str) -> Optional[dict]:
    """Internal use only (login needs the password_hash) — returns the raw
    Mongo doc, not the public-safe _serialize() shape."""
    return get_db().users.find_one({"username": username.lower()})


def create_user(username: str, password: str) -> dict:
    """Raises ValueError if the (case-insensitive) username is already taken."""
    db = get_db()
    normalized = username.lower()
    if db.users.find_one({"username": normalized}):
        raise ValueError("Username is already taken.")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    doc = {
        "username": normalized,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


def verify_password(username: str, password: str) -> Optional[dict]:
    """Returns the public-safe user dict if username+password match, else None."""
    doc = get_user_by_username(username)
    if doc is None:
        return None
    if not bcrypt.checkpw(password.encode("utf-8"), doc["password_hash"]):
        return None
    return _serialize(doc)
