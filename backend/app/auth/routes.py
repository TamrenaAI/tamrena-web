"""
POST /auth/google — frontend sends the Google ID token from Google Sign-In;
we verify it, create the user record on first sign-in, and return this
service's own session JWT.

GET /auth/me — returns the signed-in user's profile.

POST /auth/dev-login — same idea as /auth/google but with NO Google
verification at all; mints a session for a fixed test account. Only exists
when app.config.ALLOW_DEV_LOGIN is set. Exists for local/E2E testing, since
driving a real Google OAuth popup in an automated test is impractical.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.auth.google_oauth import InvalidGoogleToken, verify_google_id_token
from app.auth.models import get_or_create_user_by_google
from app.auth.tokens import create_access_token
from app.config import ALLOW_DEV_LOGIN

DEV_USER_SUB = "dev-test-user"
DEV_USER_EMAIL = "dev@tamreena.local"

router = APIRouter()


class GoogleSignInRequest(BaseModel):
    id_token: str


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None
    picture_url: str | None
    created_at: str


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture_url": user["picture_url"],
        "created_at": user["created_at"].isoformat(),
    }


@router.post("/auth/google", response_model=SessionResponse)
async def sign_in_with_google(body: GoogleSignInRequest):
    try:
        claims = verify_google_id_token(body.id_token)
    except InvalidGoogleToken as exc:
        raise HTTPException(401, f"Google sign-in failed: {exc}") from exc

    user = get_or_create_user_by_google(
        sub=claims["sub"],
        email=claims["email"],
        name=claims.get("name"),
        picture_url=claims.get("picture"),
    )
    access_token = create_access_token(user_id=user["id"])
    return SessionResponse(access_token=access_token, user=_public_user(user))


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return _public_user(user)


@router.post("/auth/dev-login", response_model=SessionResponse)
async def dev_login():
    if not ALLOW_DEV_LOGIN:
        raise HTTPException(404, "Not found.")

    user = get_or_create_user_by_google(
        sub=DEV_USER_SUB,
        email=DEV_USER_EMAIL,
        name="Dev Tester",
        picture_url=None,
    )
    access_token = create_access_token(user_id=user["id"])
    return SessionResponse(access_token=access_token, user=_public_user(user))
