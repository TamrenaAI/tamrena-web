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
