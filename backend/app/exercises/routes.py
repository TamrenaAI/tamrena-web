"""
Proxy routes forwarding to Tamreena_AI's exercise catalogue (WORKOUT_API_URL)
and the Computer-Vision service's exercise catalogue (CV_API_URL). See
app/tamreena_client.py for the shared HTTP-proxy helpers used by every BFF
proxy route module.

media_router additionally proxies Tamreena_AI's static exercise GIF/thumbnail
files at the SAME path shape Tamreena_AI itself uses (/media/exercises/...,
no /api prefix). Tamreena_AI's list/lookup responses return image_url/gif_url
as paths relative to Tamreena_AI's own origin — the browser renders the
website from a different origin, so those relative paths must resolve
against THIS service instead. No auth: media files aren't sensitive, and
matching the exact path shape lets the frontend do simple string
concatenation (BFF base URL + the path Tamreena_AI already returned) rather
than rewriting URLs.
"""

from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth.dependencies import get_verified_token
from app.config import CV_API_URL
from app.tamreena_client import call_upstream, proxy_json

router = APIRouter(prefix="/api/exercises")
media_router = APIRouter()


@router.get("")
async def list_tamreena_exercises(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/exercises", token=token)
    return proxy_json(resp)


@router.get("/lookup")
async def lookup_tamreena_exercise(name: str, token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/exercises/lookup", token=token, params={"name": name})
    return proxy_json(resp)


@router.get("/cv")
async def list_cv_exercises(token: str = Depends(get_verified_token)):
    resp = await call_upstream("GET", "/api/exercises", token=None, base_url=CV_API_URL)
    return proxy_json(resp)


@media_router.get("/media/exercises/{path:path}")
async def proxy_exercise_media(path: str):
    if ".." in path.split("/"):
        raise HTTPException(400, "Invalid media path")
    resp = await call_upstream("GET", f"/media/exercises/{path}", token=None)
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, "Media not found")
    return Response(content=resp.content, media_type=resp.headers.get("content-type", "application/octet-stream"))
