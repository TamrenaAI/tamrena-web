"""
Shared pytest fixtures. `mongo_db` (autouse) gives every test an isolated
in-memory MongoDB via mongomock, so no test ever touches a real Mongo
instance.
"""

import mongomock
import pytest

import app.db as db_module


@pytest.fixture(autouse=True)
def mongo_db(monkeypatch):
    client = mongomock.MongoClient()
    monkeypatch.setattr(db_module, "_client", client)
    yield client
