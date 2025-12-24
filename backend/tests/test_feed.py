"""Tests for public feed endpoint with participant identity and kill switch."""

from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def test_feed_accessible_without_auth(client: TestClient):
    """T006: Public feed endpoint should be accessible without researcher authentication."""
    # Setup: Create authenticated researcher, project, and experiment
    token = register_and_login(client, email="feed@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()
    public_url = experiment["publicUrl"]

    # Verify feed is accessible without auth (no headers)
    response = client.get(f"/api/feed/{public_url}")
    assert response.status_code == 200
    data = response.json()
    assert data["experimentId"] == experiment["id"]
    assert data["experimentName"] == experiment["name"]


def test_feed_returns_project_query_key(client: TestClient):
    """T004/T005: Feed should return the project's queryKey configuration."""
    token = register_and_login(client, email="querykey@test.com")
    headers = auth_headers(token)

    # Create project with custom queryKey
    response = client.post(
        "/api/projects", json={"name": "Custom Key Project", "queryKey": "userId"}, headers=headers
    )
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Get feed
    response = client.get(f"/api/feed/{experiment['publicUrl']}")
    assert response.status_code == 200
    data = response.json()
    assert data["projectSettings"]["queryKey"] == "userId"


def test_feed_rejects_inactive_experiment(client: TestClient):
    """T009: Feed should reject requests if experiment.isActive == False."""
    token = register_and_login(client, email="killswitch@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert response.status_code == 201
    project = response.json()

    # Create experiment (defaults to inactive)
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment"},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()
    public_url = experiment["publicUrl"]

    # Should receive friendly error message
    response = client.get(f"/api/feed/{public_url}")
    assert response.status_code == 403
    data = response.json()
    assert "detail" in data
    assert "active" in data["detail"].lower() or "unavailable" in data["detail"].lower()


def test_feed_accepts_active_experiment(client: TestClient):
    """T009: Feed should accept requests if experiment.isActive == True."""
    token = register_and_login(client, email="active@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

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
    token = register_and_login(client, email="interaction@test.com")
    headers = auth_headers(token)

    response = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
        headers=headers,
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
        headers=headers,
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
        headers=headers,
    )
    assert response.status_code == 201
    video = response.json()

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
    # Try to access researcher routes without logging in (no headers/token)

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


def test_feed_respects_video_ordering(client: TestClient):
    """Test that the feed endpoint returns videos in the correct order after reordering."""
    token = register_and_login(client, email="ordering@test.com")
    headers = auth_headers(token)

    # Create project
    response = client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert response.status_code == 201
    project = response.json()

    # Create experiment with isActive=True
    response = client.post(
        f"/api/projects/{project['id']}/experiments",
        json={"name": "Test Experiment", "isActive": True},
        headers=headers,
    )
    assert response.status_code == 201
    experiment = response.json()

    # Create a social account
    response = client.post(
        "/api/accounts",
        json={
            "username": "testuser",
            "displayName": "Test User",
            "avatarUrl": "https://example.com/avatar.jpg",
        },
        headers=headers,
    )
    assert response.status_code == 201
    account = response.json()

    # Create three videos
    videos = []
    for i in range(3):
        response = client.post(
            f"/api/experiments/{experiment['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "caption": f"Video {i}",
                "likes": i * 10,
                "comments": i,
                "shares": i,
                "song": "Test Song",
                "socialAccountId": account["id"],
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())

    # Get initial feed order
    response = client.get(f"/api/feed/{experiment['publicUrl']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["videos"]) == 3
    assert data["videos"][0]["caption"] == "Video 0"
    assert data["videos"][1]["caption"] == "Video 1"
    assert data["videos"][2]["caption"] == "Video 2"

    # Reorder videos: reverse the order
    reorder_payload = {
        "experimentId": experiment["id"],
        "orderedVideoIds": [videos[2]["id"], videos[1]["id"], videos[0]["id"]],
    }
    response = client.post("/api/videos/reorder", json=reorder_payload, headers=headers)
    assert response.status_code == 200

    # Get feed again to verify new order
    response = client.get(f"/api/feed/{experiment['publicUrl']}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["videos"]) == 3
    assert data["videos"][0]["caption"] == "Video 2"
    assert data["videos"][1]["caption"] == "Video 1"
    assert data["videos"][2]["caption"] == "Video 0"
