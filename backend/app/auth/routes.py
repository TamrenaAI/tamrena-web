"""
POST /auth/signup — creates a new user account (username + password),
returns this service's own session JWT immediately (auto-login on signup).

POST /auth/login — verifies username + password against the stored hash,
returns the same session shape. Returns the SAME error message whether the
username doesn't exist or the password is wrong — never reveal which.

GET /auth/me — returns the signed-in user's profile.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.auth.dependencies import get_current_user
from app.auth.models import create_user, verify_password
from app.auth.tokens import create_access_token

router = APIRouter()

_USERNAME_PATTERN = r"^[A-Za-z0-9_-]{3,30}$"


class SignUpRequest(BaseModel):
    username: str = Field(..., pattern=_USERNAME_PATTERN)
    password: str = Field(..., min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def check_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        return self


class LoginRequest(BaseModel):
    username: str
    password: str


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    username: str
    created_at: str


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "created_at": user["created_at"].isoformat(),
    }


@router.post("/auth/signup", response_model=SessionResponse, status_code=201)
async def signup(body: SignUpRequest):
    try:
        user = create_user(username=body.username, password=body.password)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc

    access_token = create_access_token(user_id=user["id"])
    return SessionResponse(access_token=access_token, user=_public_user(user))


@router.post("/auth/login", response_model=SessionResponse)
async def login(body: LoginRequest):
    user = verify_password(username=body.username, password=body.password)
    if user is None:
        raise HTTPException(401, "Invalid username or password.")

    access_token = create_access_token(user_id=user["id"])
    return SessionResponse(access_token=access_token, user=_public_user(user))


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return _public_user(user)
