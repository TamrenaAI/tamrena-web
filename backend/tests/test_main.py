"""
Tests for app/main.py — startup fail-fast behavior.
"""

import pytest
from fastapi.testclient import TestClient


def test_app_starts_successfully_with_valid_table_and_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    import importlib
    import app.config as config_module
    import app.main as main_module
    importlib.reload(config_module)  # JWT_SECRET is read from env at module import time
    importlib.reload(main_module)

    with TestClient(main_module.app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
