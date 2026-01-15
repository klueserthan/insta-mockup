from fastapi.testclient import TestClient


def test_register_login_user(client: TestClient):
    # Register
    response = client.post(
        "/api/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "name": "Test",
            "lastname": "User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "password" not in data

    # Login with JWT
    response = client.post(
        "/api/login", json={"email": "test@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    token_data = response.json()
    assert "accessToken" in token_data

    # Get Current User with JWT token
    response = client.get(
        "/api/user", headers={"Authorization": f"Bearer {token_data['accessToken']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"


def test_login_invalid_password(client: TestClient):
    client.post(
        "/api/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "name": "Test",
            "lastname": "User",
        },
    )
    response = client.post(
        "/api/login", json={"email": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_unauthorized_access(client: TestClient):
    response = client.get("/api/user")
    assert response.status_code == 401


# JWT-based auth tests (T052)


def test_jwt_login_returns_token(client: TestClient):
    """Test that login returns a JWT token in the expected format"""
    # Register user first
    client.post(
        "/api/register",
        json={
            "email": "jwt_test@example.com",
            "password": "password123",
            "name": "JWT",
            "lastname": "Test",
        },
    )

    # Login with JWT
    response = client.post(
        "/api/login", json={"email": "jwt_test@example.com", "password": "password123"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify Token schema per OpenAPI spec
    assert "accessToken" in data
    assert "tokenType" in data
    assert data["tokenType"] == "bearer"
    assert isinstance(data["accessToken"], str)
    assert len(data["accessToken"]) > 0


def test_jwt_protected_endpoint_with_valid_token(client: TestClient):
    """Test that protected endpoints accept valid JWT bearer tokens"""
    # Register and login
    client.post(
        "/api/register",
        json={
            "email": "jwt_valid@example.com",
            "password": "password123",
            "name": "Valid",
            "lastname": "Token",
        },
    )

    login_response = client.post(
        "/api/login", json={"email": "jwt_valid@example.com", "password": "password123"}
    )
    token = login_response.json()["accessToken"]

    # Access protected endpoint with Bearer token
    response = client.get("/api/user", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "jwt_valid@example.com"


def test_jwt_protected_endpoint_without_token(client: TestClient):
    """Test that protected endpoints reject requests without JWT token"""
    response = client.get("/api/user")
    assert response.status_code == 401


def test_jwt_protected_endpoint_with_invalid_token(client: TestClient):
    """Test that protected endpoints reject invalid JWT tokens"""
    response = client.get("/api/user", headers={"Authorization": "Bearer invalid_token"})
    assert response.status_code == 401


def test_jwt_protected_endpoint_with_expired_token(client: TestClient):
    """Test that protected endpoints reject expired JWT tokens"""
    import os
    from datetime import datetime, timedelta, timezone

    import jwt

    # Create an expired token manually
    secret_key = os.environ.get("SESSION_SECRET", "supersecretkey")
    expired_payload = {
        "sub": "test@example.com",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    expired_token = jwt.encode(expired_payload, secret_key, algorithm="HS256")

    response = client.get("/api/user", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401


def test_jwt_researcher_endpoints_require_auth(client: TestClient):
    """Test that researcher-only endpoints require JWT auth"""
    # Test projects endpoint without auth
    response = client.get("/api/projects")
    assert response.status_code == 401

    # Register and login to get token
    client.post(
        "/api/register",
        json={
            "email": "researcher@example.com",
            "password": "password123",
            "name": "Researcher",
            "lastname": "Test",
        },
    )

    login_response = client.post(
        "/api/login", json={"email": "researcher@example.com", "password": "password123"}
    )
    token = login_response.json()["accessToken"]

    # Test with valid token
    response = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_jwt_public_feed_no_auth_required(client: TestClient):
    """Test that public feed endpoint does not require JWT auth (T054)"""
    # This should succeed without any auth token
    # (Will 404 if experiment doesn't exist, but should not 401)
    response = client.get("/api/feed/nonexistent-token")
    # Should be 404 (not found) not 401 (unauthorized)
    assert response.status_code == 404


def test_jwt_public_interactions_no_auth_required(client: TestClient):
    """Test that participant interaction logging does not require JWT auth (T054)"""
    from uuid import uuid4

    # This should work without auth (though may fail validation if experiment doesn't exist)
    response = client.post(
        "/api/interactions",
        json={
            "participantId": "test-participant",
            "experimentId": str(uuid4()),
            "videoId": str(uuid4()),
            "interactionType": "view",
        },
    )
    # Should not be 401 (unauthorized) - might be 422 (validation) or 201 (success)
    assert response.status_code != 401


# Refresh token tests (TODO-C2)


def test_refresh_token_returned_on_login(client: TestClient):
    """Test that login returns a refresh token"""
    # Register user first
    client.post(
        "/api/register",
        json={
            "email": "refresh_test@example.com",
            "password": "password123",
            "name": "Refresh",
            "lastname": "Test",
        },
    )

    # Login
    response = client.post(
        "/api/login", json={"email": "refresh_test@example.com", "password": "password123"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify refresh token is present
    assert "refreshToken" in data
    assert isinstance(data["refreshToken"], str)
    assert len(data["refreshToken"]) > 0


def test_refresh_token_returned_on_register(client: TestClient):
    """Test that registration returns a refresh token"""
    response = client.post(
        "/api/register",
        json={
            "email": "refresh_reg_test@example.com",
            "password": "password123",
            "name": "Refresh",
            "lastname": "Reg",
        },
    )

    assert response.status_code == 201
    data = response.json()

    # Verify refresh token is present
    assert "refreshToken" in data
    assert isinstance(data["refreshToken"], str)
    assert len(data["refreshToken"]) > 0


def test_refresh_access_token_with_valid_refresh_token(client: TestClient):
    """Test that we can get a new access token using a refresh token"""
    # Register and login
    client.post(
        "/api/register",
        json={
            "email": "refresh_valid@example.com",
            "password": "password123",
            "name": "Valid",
            "lastname": "Refresh",
        },
    )

    login_response = client.post(
        "/api/login", json={"email": "refresh_valid@example.com", "password": "password123"}
    )
    refresh_token = login_response.json()["refreshToken"]

    # Use refresh token to get new access token
    response = client.post("/api/refresh", json={"refreshToken": refresh_token})

    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data
    assert "tokenType" in data
    assert data["tokenType"] == "bearer"
    assert isinstance(data["accessToken"], str)
    assert len(data["accessToken"]) > 0


def test_refresh_token_with_invalid_token(client: TestClient):
    """Test that invalid refresh token is rejected"""
    response = client.post("/api/refresh", json={"refreshToken": "invalid_token_12345"})

    assert response.status_code == 401
    assert "Invalid or expired refresh token" in response.json()["detail"]


def test_revoke_refresh_token(client: TestClient):
    """Test that we can revoke a refresh token"""
    # Register and login
    client.post(
        "/api/register",
        json={
            "email": "revoke_test@example.com",
            "password": "password123",
            "name": "Revoke",
            "lastname": "Test",
        },
    )

    login_response = client.post(
        "/api/login", json={"email": "revoke_test@example.com", "password": "password123"}
    )
    refresh_token = login_response.json()["refreshToken"]

    # Revoke the token
    revoke_response = client.post("/api/revoke", json={"refreshToken": refresh_token})
    assert revoke_response.status_code == 200
    assert "Token revoked" in revoke_response.json()["message"]

    # Try to use revoked token
    refresh_response = client.post("/api/refresh", json={"refreshToken": refresh_token})
    assert refresh_response.status_code == 401
    assert "Invalid or expired refresh token" in refresh_response.json()["detail"]
