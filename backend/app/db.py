"""
Shared MongoDB client — this service's OWN database, never Tamreena_AI's.
"""

from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import OperationFailure

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

    # Drop indexes from the removed Google-auth schema. Idempotent: a
    # brand-new database never had these, so IndexNotFound is expected
    # and safe to ignore — this only matters for existing deployments
    # migrating from the old schema (see the DuplicateKeyError this
    # caused live: a null google_sub collided on the second real signup,
    # since Mongo's unique index only tolerates one null value).
    for stale_index in ("google_sub_1", "email_1"):
        try:
            db.users.drop_index(stale_index)
        except OperationFailure:
            pass

    db.users.create_index("username", unique=True)
