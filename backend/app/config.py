"""
Central configuration for the Tamreena Web BFF — environment loading.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

# ── DynamoDB (this service's OWN table, never Tamreena_AI's) ──────────
AWS_REGION = os.getenv("AWS_REGION", "eu-north-1")
DYNAMODB_TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "workout_users")
LIVE_SESSIONS_TABLE_NAME = os.getenv("LIVE_SESSIONS_TABLE_NAME", "workout_live_sessions")

# ── Auth ──────────────────────────────────────────────────────────────
# JWT_SECRET MUST match Tamreena_AI's own JWT_SECRET exactly — tokens
# minted here are verified by that repo's API using this same secret.
# See Tamreena_AI/docs/superpowers/specs/2026-07-25-bff-auth-handoff-design.md.
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days, matches Tamreena_AI's own token lifetime

# ── Tamreena_AI proxy ────────────────────────────────────────────────
# Base URL for Tamreena_AI's plan-generation API. Every workout proxy route
# forwards the caller's own Bearer token here — see docs/superpowers/specs/
# 2026-07-25-website-shell-home-workout-design.md in Tamreena_AI.
WORKOUT_API_URL = os.getenv("WORKOUT_API_URL", "http://localhost:8001")

# ── Computer-Vision proxy ────────────────────────────────────────────────
# Base URL for the Computer-Vision service's exercise catalogue API. That
# service has no auth of its own — see app/tamreena_client.py's
# call_upstream() for how calls to it omit the Authorization header.
CV_API_URL = os.getenv("CV_API_URL", "http://localhost:8002")

# ── Nutrition-Plan-Generation proxy ──────────────────────────────────
# Base URL for the Nutrition-Plan-Generation service's real macro/meal-plan
# generation API. That service has no auth of its own — see
# app/tamreena_client.py's call_upstream() for how calls to it omit the
# Authorization header.
NUTRITION_API_URL = os.getenv("NUTRITION_API_URL", "http://localhost:8000")
