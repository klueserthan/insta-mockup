import os
from pathlib import Path

import dotenv

# Load .env from backend directory
env_path = Path(__file__).parent / ".env"
dotenv.load_dotenv(env_path)

# Base directory of the application
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Directory for storing uploaded files
# Defaults to 'uploads' in the project root, but can be overridden by env var
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))

# Storage Configuration
# Options: 'LOCAL', 'S3'
# Base URL for local file serving (e.g., http://localhost:8000)
# In production, this might be the domain name
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")

# Base URL for local file serving
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


# RocketAPI Configuration
ROCKET_API_KEY = os.getenv("ROCKET_API_KEY")
if not ROCKET_API_KEY:
    raise ValueError("ROCKET_API_KEY must be set in environment variables")

# JWT Configuration
SESSION_SECRET = os.environ.get("SESSION_SECRET")
ENVIRONMENT = os.environ.get("ENV", os.environ.get("APP_ENV", "development")).lower()

if ENVIRONMENT == "production" and not SESSION_SECRET:
    raise RuntimeError(
        "SESSION_SECRET environment variable must be set in production; "
        "refusing to use insecure default JWT secret."
    )

if not SESSION_SECRET and ENVIRONMENT == "development":
    import warnings

    warnings.warn(
        "SESSION_SECRET not set. Using insecure default for development. "
        "This is NOT safe for production!",
        stacklevel=2,
    )

SECRET_KEY = SESSION_SECRET or "dev-only-supersecretkey-change-in-production"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ALGORITHM = "HS256"
