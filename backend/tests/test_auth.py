from fastapi.testclient import TestClient

def test_register_login_user(client: TestClient):
    # Register
    response = client.post(
        "/api/register",
        json={"email": "test@example.com", "password": "password123", "name": "Test", "lastname": "User"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "password" not in data

    # Login
    response = client.post(
        "/api/login",
        data={"username": "test@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    
    # Get Current User
    response = client.get("/api/user")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"

def test_login_invalid_password(client: TestClient):
    client.post(
        "/api/register",
        json={"email": "test@example.com", "password": "password123", "name": "Test", "lastname": "User"}
    )
    response = client.post(
        "/api/login",
        data={"username": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_unauthorized_access(client: TestClient):
    response = client.get("/api/user")
    assert response.status_code == 401
