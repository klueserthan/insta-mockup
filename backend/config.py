import os

import dotenv

dotenv.load_dotenv()

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
