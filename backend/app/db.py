"""
Shared MongoDB client — this service's OWN database, never Tamreena_AI's.
"""

from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database

from app.config import MONGO_DB_NAME, MONGO_URI

_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client


def get_db() -> Database:
    return get_client()[MONGO_DB_NAME]


def ensure_indexes() -> None:
    db = get_db()
    db.users.create_index("google_sub", unique=True)
    db.users.create_index("email", unique=True)
