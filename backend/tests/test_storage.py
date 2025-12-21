import os

import pytest
from fastapi.testclient import TestClient

from auth import get_current_user
from config import BASE_URL, UPLOAD_DIR
from main import app


@pytest.fixture(autouse=True)
def clean_uploads():
    # Only clean if needed, or rely on unique names
    yield


def test_simple_upload_flow(client: TestClient):
    # Mock Auth
    app.dependency_overrides[get_current_user] = lambda: {"id": "testuser", "username": "test"}

    # 1. Upload valid image via POST (multipart)
    # Minimal valid PNG header
    png_content = b"\x89PNG\r\n\x1a\n"
    files = {"file": ("test.png", png_content, "image/png")}

    response = client.post("/api/objects/upload", files=files)
    assert response.status_code == 200
    data = response.json()

    # Check response structure
    assert "url" in data
    assert "filename" in data
    assert data["original_filename"] == "test.png"
    assert data["url"].startswith(f"{BASE_URL}/media/")

    # Check file exists on disk
    filename = data["filename"]
    filepath = os.path.join(UPLOAD_DIR, filename)
    assert os.path.exists(filepath)

    # Check access via public URL
    public_url = data["url"]
    relative_path = public_url.replace("http://localhost:8000", "")
    get_res = client.get(relative_path)
    assert get_res.status_code == 200
    assert get_res.content == png_content

    app.dependency_overrides.pop(get_current_user)


def test_upload_invalid_type(client: TestClient):
    app.dependency_overrides[get_current_user] = lambda: {"id": "testuser", "username": "test"}

    # Text file -> should fail
    files = {"file": ("test.txt", b"some text", "text/plain")}

    response = client.post("/api/objects/upload", files=files)
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]

    app.dependency_overrides.pop(get_current_user)
