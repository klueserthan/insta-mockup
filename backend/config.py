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

# Check for insecure placeholder values
INSECURE_PLACEHOLDERS = [
    "your_session_secret_key_here",
    "supersecretkey",
    "changeme",
    "secret",
    "password",
]

# Treat placeholder values as if SESSION_SECRET is not set
if SESSION_SECRET and SESSION_SECRET.lower() in INSECURE_PLACEHOLDERS:
    import warnings

    warnings.warn(
        f"SESSION_SECRET is set to an insecure placeholder value: '{SESSION_SECRET}'. "
        "This is NOT safe for production! Generate a secure secret with: openssl rand -hex 32",
        stacklevel=2,
    )
    if ENVIRONMENT == "production":
        raise RuntimeError(
            "SESSION_SECRET is set to an insecure placeholder value in production; "
            "refusing to use insecure placeholder. Generate a secure secret with: openssl rand -hex 32"
        )
    SESSION_SECRET = None  # Treat as not set

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

# Rate Limiting Configuration (H1)
RATE_LIMIT_DEFAULT = os.environ.get("RATE_LIMIT_DEFAULT", "200/minute")
RATE_LIMIT_FEED = os.environ.get("RATE_LIMIT_FEED", "60/minute")
RATE_LIMIT_INTERACTIONS = os.environ.get("RATE_LIMIT_INTERACTIONS", "120/minute")
RATE_LIMIT_HEARTBEAT = os.environ.get("RATE_LIMIT_HEARTBEAT", "300/minute")

# Ollama Cloud Configuration (for AI comment generation)
OLLAMA_API_TOKEN = os.environ.get("OLLAMA_API_TOKEN")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
