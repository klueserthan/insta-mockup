import os
from contextlib import asynccontextmanager
from typing import cast

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.sessions import SessionMiddleware

from auth import router as auth_router
from config import RATE_LIMIT_DEFAULT, SECRET_KEY, UPLOAD_DIR
from database import create_db_and_tables
from routes import (
    accounts,
    comments,
    experiments,
    feed,
    instagram,
    interactions,
    projects,
    storage,
    videos,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    # No longer auto-creating dev user on startup for security
    yield


app = FastAPI(title="Insta Mockup API", lifespan=lifespan)

# Configure rate limiting (H1)
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT_DEFAULT])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(object, _rate_limit_exceeded_handler))  # type: ignore

# Configure Session Middleware
# Import SECRET_KEY from config.py to ensure consistency
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Configure CORS - read allowed origins from environment variable
allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://0.0.0.0:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(projects.router)
app.include_router(experiments.router)
app.include_router(videos.router)
app.include_router(comments.router)
app.include_router(accounts.router)
app.include_router(storage.router)
app.include_router(feed.router)
app.include_router(interactions.router)
app.include_router(instagram.router)

# Mount uploads directory to /media to serve files locally
if os.path.exists(UPLOAD_DIR):
    app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
