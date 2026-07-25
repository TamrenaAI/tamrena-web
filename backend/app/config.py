"""
Central configuration for the Tamreena Web BFF — environment loading.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

# ── MongoDB (this service's OWN Mongo — never shared with Tamreena_AI's) ──
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27018")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "tamreena_web")

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
