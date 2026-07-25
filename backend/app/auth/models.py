"""
User accounts — this service's OWN `users` collection (see app/db.py).
Google is the only sign-in method (google_sub is required).
"""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId

from app.db import get_db


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "google_sub": doc["google_sub"],
        "email": doc["email"],
        "name": doc.get("name"),
        "picture_url": doc.get("picture_url"),
        "created_at": doc["created_at"],
    }


def get_user_by_id(user_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        return None
    doc = get_db().users.find_one({"_id": oid})
    return _serialize(doc) if doc else None


def get_or_create_user_by_google(sub: str, email: str, name: Optional[str], picture_url: Optional[str]) -> dict:
    db = get_db()
    doc = db.users.find_one({"google_sub": sub})
    if doc:
        return _serialize(doc)

    doc = {
        "google_sub": sub,
        "email": email,
        "name": name,
        "picture_url": picture_url,
        "created_at": datetime.now(timezone.utc),
    }
    result = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)
