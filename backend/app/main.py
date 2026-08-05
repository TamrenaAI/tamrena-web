"""
FastAPI application entry point for the Tamreena Web BFF.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import routes as auth_routes
from app.coach import routes as coach_routes
from app.exercises import routes as exercises_routes
from app.progress import routes as progress_routes
from app.workout import routes as workout_routes
from app.live_session import routes as live_session_routes
from app.nutrition import routes as nutrition_routes
from app.db import get_users_table


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.config import DYNAMODB_TABLE_NAME, JWT_SECRET

    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — the service cannot issue or verify sessions without it.")

    table = get_users_table()
    table.load()  # raises botocore.exceptions.ClientError if the table doesn't exist/isn't reachable
    if table.table_status != "ACTIVE":
        raise RuntimeError(f"DynamoDB table '{DYNAMODB_TABLE_NAME}' is not ACTIVE (status: {table.table_status}).")

    yield


app = FastAPI(title="Tamreena Web BFF", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth_routes.router, tags=["auth"])
app.include_router(progress_routes.router, tags=["progress"])
app.include_router(exercises_routes.router, tags=["exercises"])
app.include_router(exercises_routes.media_router, tags=["exercises-media"])
app.include_router(workout_routes.router, tags=["workout"])
app.include_router(live_session_routes.router, tags=["live-session"])
app.include_router(nutrition_routes.router, tags=["nutrition"])
app.include_router(coach_routes.router, tags=["coach"])
