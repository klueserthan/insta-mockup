from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def test_create_get_projects(client: TestClient):
    # Register and login first
    token = register_and_login(client, email="project@example.com")
    headers = auth_headers(token)

    # Create Project
    response = client.post(
        "/api/projects",
        json={"name": "Test Project", "queryKey": "pid", "timeLimitSeconds": 600},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["queryKey"] == "pid"
    project_id = data["id"]

    # Get Projects List
    response = client.get("/api/projects", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == project_id

    # Get Single Project
    response = client.get(f"/api/projects/{project_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == project_id

    # Update Project
    response = client.patch(
        f"/api/projects/{project_id}", json={"name": "Updated Project"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Project"

    # Delete Project
    response = client.delete(f"/api/projects/{project_id}", headers=headers)
    assert response.status_code == 204

    # Verify Deletion
    response = client.get(f"/api/projects/{project_id}", headers=headers)
    assert response.status_code == 404


def test_project_access_control(client: TestClient):
    # User 1
    token1 = register_and_login(client, email="u1@e.com")
    headers1 = auth_headers(token1)
    response = client.post("/api/projects", json={"name": "P1"}, headers=headers1)
    assert response.status_code == 201, f"Create P1 failed: {response.text}"
    p1 = response.json()

    # User 2
    token2 = register_and_login(client, email="u2@e.com")
    headers2 = auth_headers(token2)

    # U2 accessing P1
    response = client.get(f"/api/projects/{p1['id']}", headers=headers2)
    assert response.status_code in (403, 404)
