"""
Proxy route for the coach chatbot: looks up the user's last-generated
nutrition plan (this BFF is the only service that knows the mapping from
user_id to nutrition run_id -- see app/auth/models.py) and forwards it
alongside the chat message to Tamreena_AI's real coach agent
(WORKOUT_API_URL). See
docs/superpowers/specs/2026-08-05-nutrition-workout-coach-chatbot-design.md
in the Tamrena-Workout repo for the full design.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_verified_token
from app.auth.models import get_last_nutrition_run_id
from app.auth.tokens import decode_access_token
from app.config import NUTRITION_API_URL
from app.tamreena_client import LLM_TIMEOUT, call_upstream, proxy_json

router = APIRouter(prefix="/api/coach")


class CoachChatRequest(BaseModel):
    message: str


async def _fetch_nutrition_snapshot(user_id: str) -> Optional[str]:
    run_id = get_last_nutrition_run_id(user_id)
    if not run_id:
        return None
    resp = await call_upstream(
        "GET", f"/api/v1/nutrition/result/{run_id}", token=None, base_url=NUTRITION_API_URL
    )
    if resp is None or resp.status_code != 200:
        return None
    try:
        return json.dumps(resp.json())
    except ValueError:
        return None


@router.post("/chat")
async def coach_chat(body: CoachChatRequest, token: str = Depends(get_verified_token)):
    user_id = decode_access_token(token)
    snapshot = await _fetch_nutrition_snapshot(user_id)
    resp = await call_upstream(
        "POST",
        "/coach/chat",
        token=token,
        timeout=LLM_TIMEOUT,
        json={"message": body.message, "nutrition_plan_snapshot": snapshot},
    )
    return proxy_json(resp)
