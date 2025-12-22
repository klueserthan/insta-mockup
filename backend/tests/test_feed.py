"""Tests for public feed endpoint with participant identity and kill switch."""

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, *, email: str) -> None:
    """Helper to register and login a researcher."""
    client.post(
        "/api/register",
        json={"email": email, "password": "password123", "name": "Test", "lastname": "User"},
    )
    resp = client.post("/api/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200, resp.text


def test_feed_accessible_without_auth(client: TestClient):
    """T006: Public feed endpoint should be accessible without researcher authentication."""
    # Setup: Create authenticated researcher, project, and experiment
    _register_and_login(client, email="feed@test.com")

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"})
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
    )
    assert response.status_code == 201
    experiment = response.json()
    public_url = experiment["publicUrl"]

    # Logout to simulate anonymous participant
    client.post("/api/logout")

    # Verify feed is accessible without auth
    response = client.get(f"/api/feed/{public_url}")
    assert response.status_code == 200
    data = response.json()
    assert data["experimentId"] == experiment["id"]
    assert data["experimentName"] == experiment["name"]


def test_feed_returns_project_query_key(client: TestClient):
    """T004/T005: Feed should return the project's queryKey configuration."""
    _register_and_login(client, email="querykey@test.com")

    # Create project with custom queryKey
    response = client.post(
        "/api/projects", json={"name": "Custom Key Project", "queryKey": "userId"}
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
    )
    assert response.status_code == 201
    experiment = response.json()

    # Logout and access feed as participant
    client.post("/api/logout")

    # Get feed
    response = client.get(f"/api/feed/{experiment['publicUrl']}")
    assert response.status_code == 200
    data = response.json()
    assert data["projectSettings"]["queryKey"] == "userId"


def test_feed_rejects_inactive_experiment(client: TestClient):
    """T009: Feed should reject requests if experiment.isActive == False."""
    _register_and_login(client, email="killswitch@test.com")

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"})
    assert response.status_code == 201
    project = response.json()

    # Create experiment (defaults to inactive)
    response = client.post(
        f"/api/projects/{project['id']}/experiments", json={"name": "Test Experiment"}
    )
    assert response.status_code == 201
    experiment = response.json()
    public_url = experiment["publicUrl"]

    # Logout and try to access feed as participant
    client.post("/api/logout")

    # Should receive friendly error message
    response = client.get(f"/api/feed/{public_url}")
    assert response.status_code == 403
    data = response.json()
    assert "detail" in data
    assert "active" in data["detail"].lower() or "unavailable" in data["detail"].lower()


def test_feed_accepts_active_experiment(client: TestClient):
    """T009: Feed should accept requests if experiment.isActive == True."""
    _register_and_login(client, email="active@test.com")

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"})
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
    )
    assert response.status_code == 201
    experiment = response.json()

    # Logout and access feed as participant
    client.post("/api/logout")

    # Should succeed
    response = client.get(f"/api/feed/{experiment['publicUrl']}")
    assert response.status_code == 200


def test_feed_not_found_friendly_error(client: TestClient):
    """T009a: Feed should return friendly error for invalid public_url."""
    # No auth needed
    response = client.get("/api/feed/nonexistent-url")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    # Should have a clear message
    assert len(data["detail"]) > 0


def test_interaction_logging_accessible_without_auth(client: TestClient):
    """T006: Interaction logging should be accessible without researcher authentication."""
    # Setup: Create experiment
    _register_and_login(client, email="interaction@test.com")

    response = client.post("/api/projects", json={"name": "Test Project"})
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account and video for interaction logging
    response = client.post(
        "/api/accounts",
        json={
            "username": "testuser",
            "displayName": "Test User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
    )
    assert response.status_code == 201
    account = response.json()

    # Upload/create a video
    response = client.post(
        f"/api/experiments/{experiment['id']}/videos",
        json={
            "filename": "test.mp4",
            "caption": "Test video",
            "likes": 100,
            "comments": 10,
            "shares": 5,
            "song": "Test Song",
            "socialAccountId": account["id"],
        },
    )
    assert response.status_code == 201
    video = response.json()

    # Logout to simulate anonymous participant
    client.post("/api/logout")

    # Try to log an interaction without auth
    response = client.post(
        "/api/interactions",
        json={
            "participantId": "test-participant-123",
            "experimentId": experiment["id"],
            "videoId": video["id"],
            "interactionType": "view",
            "interactionData": {"timestamp": "2024-01-01T00:00:00Z"},
        },
    )
    assert response.status_code == 201


def test_researcher_routes_require_auth(client: TestClient):
    """T007: All researcher configuration routes should require authentication."""
    # Try to access researcher routes without logging in

    # Projects
    response = client.get("/api/projects")
    assert response.status_code == 401

    response = client.post("/api/projects", json={"name": "Test"})
    assert response.status_code == 401

    # User endpoint
    response = client.get("/api/user")
    assert response.status_code == 401

    # Accounts
    response = client.post(
        "/api/accounts", json={"username": "test", "displayName": "Test", "avatarUrl": "test.jpg"}
    )
    assert response.status_code == 401
