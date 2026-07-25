"""
Nutrition routes: proxies real macro/meal-plan generation to the
Nutrition-Plan-Generation coworker service (a real multi-agent LangGraph
pipeline, not mocked). That service has no auth of its own — the BFF
still requires the caller to be signed in, same pattern as the
Computer-Vision and Workout proxies. The SSE progress-stream proxy is
added onto this same router in a later change — see
stream_nutrition_progress below.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.auth.dependencies import get_verified_token
from app.config import NUTRITION_API_URL
from app.tamreena_client import call_upstream, proxy_json

router = APIRouter(prefix="/api/nutrition")


class NutritionGenerateRequest(BaseModel):
    age: int = Field(..., ge=10, le=100)
    gender: Literal["male", "female"]
    height_cm: float = Field(..., ge=100, le=250)
    weight_kg: float = Field(..., ge=30, le=300)
    goal: Literal["fat_loss", "weight_loss", "muscle_gain", "bulking", "maintenance", "recomposition"]
    activity_level: Literal["sedentary", "lightly_active", "moderate", "very_active", "extra_active"] = "moderate"
    diet_type: Literal["normal", "vegetarian", "vegan", "keto", "high_protein"] = "normal"
    preferences: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    additional_notes: Optional[str] = Field(default=None, max_length=500)
    # Locked to "dataset" — this stage never exposes the llm_arabic mode
    # (triple_meal_plan) in the UI. See docs/superpowers/specs/
    # 2026-07-25-website-nutrition-design.md's Decisions section.
    meal_generation_mode: Literal["dataset"] = "dataset"


@router.post("/generate")
async def generate_nutrition_plan(body: NutritionGenerateRequest, token: str = Depends(get_verified_token)):
    resp = await call_upstream(
        "POST", "/api/v1/nutrition/generate", token=None, base_url=NUTRITION_API_URL, json=body.model_dump()
    )
    return proxy_json(resp)


@router.get("/result/{run_id}")
async def get_nutrition_result(run_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream(
        "GET", f"/api/v1/nutrition/result/{run_id}", token=None, base_url=NUTRITION_API_URL
    )
    return proxy_json(resp)
