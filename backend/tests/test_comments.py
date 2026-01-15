from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def _create_account(client: TestClient, token: str) -> dict:
    resp = client.post(
        "/api/accounts",
        json={
            "username": "commenter",
            "displayName": "Commenter",
            "avatarUrl": "/media/avatar.png",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_comments(client: TestClient):
    # Setup
    token = register_and_login(client, email="com@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
    v1 = client.post(
        f"/api/experiments/{e1['id']}/videos",
        json={
            "filename": "v.mp4",
            "socialAccountId": account["id"],
            "caption": "c",
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "song": "s",
        },
        headers=headers,
    ).json()
    vid_id = v1["id"]

    # Create Comment
    response = client.post(
        f"/api/videos/{vid_id}/comments",
        json={"authorName": "Author", "authorAvatar": "http://avatar", "body": "Comment Body"},
        headers=headers,
    )
    assert response.status_code == 201
    comment = response.json()
    assert comment["body"] == "Comment Body"
    com_id = comment["id"]

    # Get Comments
    response = client.get(f"/api/videos/{vid_id}/comments", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

    # Update Comment
    response = client.patch(
        f"/api/comments/{com_id}", json={"body": "Updated Body"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["body"] == "Updated Body"

    # Delete Comment
    response = client.delete(f"/api/comments/{com_id}", headers=headers)
    assert response.status_code == 204


def test_generate_comments_requires_auth(client: TestClient):
    """Test that generating comments requires authentication."""
    response = client.post(
        "/api/videos/fake-id/comments/generate", json={"count": 5, "tone": "mixed"}
    )
    assert response.status_code == 401


def test_generate_comments_basic(client: TestClient, monkeypatch):
    """Test basic comment generation with AI - success path with mocked API."""
    # Setup
    token = register_and_login(client, email="gencom@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
    v1 = client.post(
        f"/api/experiments/{e1['id']}/videos",
        json={
            "filename": "v.mp4",
            "socialAccountId": account["id"],
            "caption": "Amazing sunset over the ocean",
            "likes": 100,
            "comments": 10,
            "shares": 5,
            "song": "Chill Vibes",
        },
        headers=headers,
    ).json()
    vid_id = v1["id"]

    # Mock the AI generation to avoid needing actual API key in tests
    from unittest.mock import AsyncMock, MagicMock, patch

    # Mock the singleton agent instance
    mock_agent = MagicMock()
    mock_result = MagicMock()
    mock_generated_comment = MagicMock()
    mock_generated_comment.body = "Great video! 🔥"
    mock_generated_comment.username = "test_user_123"
    mock_generated_comment.likes = 5
    mock_result.data = mock_generated_comment
    mock_agent.run = AsyncMock(return_value=mock_result)

    # Patch the singleton instance
    with patch("routes.comments._comment_agent", mock_agent):
        # Generate comments
        response = client.post(
            f"/api/videos/{vid_id}/comments/generate",
            json={"count": 3, "tone": "positive"},
            headers=headers,
        )

    # Should succeed with mocked response
    assert response.status_code == 201
    comments = response.json()
    assert isinstance(comments, list)
    assert len(comments) == 3
    for comment in comments:
        assert "authorName" in comment
        assert "body" in comment
        assert "source" in comment
        assert comment["source"] == "ai"


def test_generate_comments_api_failure(client: TestClient, monkeypatch):
    """Test comment generation with API connection failure."""
    # Setup
    token = register_and_login(client, email="apifail@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
    v1 = client.post(
        f"/api/experiments/{e1['id']}/videos",
        json={
            "filename": "v.mp4",
            "socialAccountId": account["id"],
            "caption": "Test video",
            "likes": 10,
            "comments": 5,
            "shares": 2,
            "song": "Test Song",
        },
        headers=headers,
    ).json()
    vid_id = v1["id"]

    # Mock singleton agent that fails
    from unittest.mock import MagicMock, patch

    mock_agent = MagicMock()
    mock_agent.run.side_effect = Exception("API connection failed")

    # Generate comments - should fail with actual API call
    with patch("routes.comments._comment_agent", mock_agent):
        response = client.post(
            f"/api/videos/{vid_id}/comments/generate",
            json={"count": 3, "tone": "positive"},
            headers=headers,
        )

    # Should return 500 for API connection issues
    assert response.status_code == 500
    data = response.json()
    assert "detail" in data


def test_generate_comments_without_api_token(client: TestClient, monkeypatch):
    """Test that generating comments without API token returns appropriate error."""
    # Setup
    token = register_and_login(client, email="notoken@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
    v1 = client.post(
        f"/api/experiments/{e1['id']}/videos",
        json={
            "filename": "v.mp4",
            "socialAccountId": account["id"],
            "caption": "Test caption",
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "song": "s",
        },
        headers=headers,
    ).json()
    vid_id = v1["id"]

    # Mock that agent was not created (no API token)
    from unittest.mock import patch

    with patch("routes.comments._comment_agent", None):
        # Try to generate comments
        response = client.post(
            f"/api/videos/{vid_id}/comments/generate",
            json={"count": 3, "tone": "mixed"},
            headers=headers,
        )

    # Should return error about missing API token (503, not 500)
    assert response.status_code == 503
    data = response.json()
    assert "detail" in data
    assert "ollama" in data["detail"].lower() or "api" in data["detail"].lower()
