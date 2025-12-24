"""Shared test helpers for JWT-based authentication"""

from fastapi.testclient import TestClient


def register_and_login(client: TestClient, *, email: str) -> str:
    """Register and login, return JWT token for use in Authorization header"""
    client.post(
        "/api/register",
        json={"email": email, "password": "password123", "name": "Test", "lastname": "User"},
    )
    resp = client.post("/api/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


def auth_headers(token: str) -> dict:
    """Return Authorization header dict from JWT token"""
    return {"Authorization": f"Bearer {token}"}
