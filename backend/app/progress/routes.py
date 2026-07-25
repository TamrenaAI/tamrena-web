"""
Proxy routes forwarding to Tamreena_AI's progress-tracking and monthly-review
API (WORKOUT_API_URL). See app/tamreena_client.py for the shared HTTP-proxy
helpers used by every BFF proxy route module.

Monthly Review is same-goal-only in this BFF today: the "my goal changed"
full-intake resubmission path Tamreena_AI's API supports is deliberately not
exposed here yet — see docs/superpowers/specs/2026-07-25-website-progress-tab-design.md
in Tamreena_AI.
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.auth.dependencies import get_verified_token
from app.tamreena_client import LLM_TIMEOUT, call_upstream, proxy_json

router = APIRouter(prefix="/api/progress")


@router.get("/scans")
async def get_scans(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/progress/scans", token=token)
    return proxy_json(resp)


@router.get("/comparison")
async def get_comparison(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/progress/comparison", token=token)
    return proxy_json(resp)


@router.get("/{session_id}/report")
async def get_report(session_id: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", f"/progress/{session_id}/report", token=token)
    return proxy_json(resp)


@router.post("/{session_id}/monthly-review")
async def start_monthly_review(
    session_id: str,
    inbody_file: UploadFile = File(...),
    token: str = Depends(get_verified_token),
):
    file_bytes = await inbody_file.read()
    files = {"inbody_file": (inbody_file.filename, file_bytes, inbody_file.content_type)}
    data = {"same_goal": "true"}
    resp = await call_upstream(
        "POST", f"/plan/{session_id}/monthly-review", token=token, timeout=LLM_TIMEOUT, files=files, data=data
    )
    return proxy_json(resp)
