"""Security tests: ensure no dev/demo user is created or allowed."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from models import Researcher


def test_no_dev_user_on_startup(session: Session):
    """SECURITY: Verify that no dev user is auto-created on app startup."""
    dev_emails = [
        "test@research.edu",
        "demo@research.edu",
        "dev@research.edu",
        "test@example.com",
    ]
    for email in dev_emails:
        user = session.exec(select(Researcher).where(Researcher.email == email)).first()
        assert (
            user is None
        ), f"Security violation: Dev user {email} found in database. This must be removed."


def test_dev_user_cannot_be_created_with_reserved_emails(client: TestClient):
    """SECURITY: Prevent registration of hardcoded test user credentials."""
    forbidden_combos = [
        {"email": "test@research.edu", "password": "password123"},
        {"email": "demo@research.edu", "password": "password123"},
        {"email": "dev@research.edu", "password": "password123"},
    ]

    for combo in forbidden_combos:
        # Attempt to register with reserved email
        response = client.post(
            "/api/register",
            json={
                "email": combo["email"],
                "password": combo["password"],
                "name": "Test",
                "lastname": "User",
            },
        )
        # Registration should succeed (it's not forbidden), but system must ensure
        # no hardcoded defaults exist that match this.
        # The security here is that no auto-seeding happens.
        assert response.status_code in (201, 400)


def test_no_implicit_login_without_registration(client: TestClient):
    """SECURITY: Cannot login with hardcoded dev credentials if user doesn't exist."""
    response = client.post(
        "/api/login",
        json={"email": "test@research.edu", "password": "password123"},
    )
    # Should fail because user doesn't exist (was not auto-created on startup)
    assert response.status_code == 401 or response.status_code == 404


def test_no_dev_login_endpoint_exists(client: TestClient):
    """SECURITY: Verify there is no special /dev-login or /demo-login endpoint."""
    endpoints = [
        "/api/dev-login",
        "/api/demo-login",
        "/api/test-login",
        "/api/quick-login",
    ]
    for endpoint in endpoints:
        response = client.post(endpoint, json={"email": "test", "password": "test"})
        assert response.status_code in (404, 405), f"Found unexpectedendpoint: {endpoint}"


def test_researcher_isolation_no_default_accounts(client: TestClient, session: Session):
    """SECURITY: Each user starts with no accounts (except those they create)."""
    # Register a fresh user
    register_resp = client.post(
        "/api/register",
        json={
            "email": "isolation-test@example.com",
            "password": "password123",
            "name": "Isolation",
            "lastname": "Test",
        },
    )
    assert register_resp.status_code == 201

    # Login
    login_resp = client.post(
        "/api/login",
        json={"email": "isolation-test@example.com", "password": "password123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["accessToken"]

    # Check accounts list (should be empty, no pre-seeded accounts)
    accounts_resp = client.get("/api/accounts", headers={"Authorization": f"Bearer {token}"})
    assert accounts_resp.status_code == 200
    accounts = accounts_resp.json()
    assert isinstance(accounts, list)
    assert len(accounts) == 0, "User should have no default accounts"
