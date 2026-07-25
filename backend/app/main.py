"""
FastAPI application entry point for the Tamreena Web BFF.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import routes as auth_routes
from app.workout import routes as workout_routes
from app.db import ensure_indexes


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_indexes()

    from app.config import JWT_SECRET
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set — the service cannot issue or verify sessions without it.")

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
app.include_router(workout_routes.router, tags=["workout"])
