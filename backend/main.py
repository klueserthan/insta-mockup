from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from config import UPLOAD_DIR
import os

from auth import router as auth_router
from routes import projects, experiments, videos, comments, accounts, storage, feed, interactions
from database import create_db_and_tables

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="Insta Mockup API", lifespan=lifespan)

# Configure Session Middleware
# Ideally verify SECRET_KEY in env
SECRET_KEY = os.environ.get("SESSION_SECRET", "supersecretkey")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://0.0.0.0:5173"], 
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

# Mount uploads directory to /media to serve files locally
if os.path.exists(UPLOAD_DIR):
    app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
