from fastapi.testclient import TestClient

def test_create_get_experiments(client: TestClient):
    # Setup User and Project
    client.post("/api/register", json={"email": "exp@e.com", "password": "password123", "name": "E", "lastname": "X"})
    l = client.post("/api/login", data={"username": "exp@e.com", "password": "password123"})
    assert l.status_code == 200
    response = client.post("/api/projects", json={"name": "P1"})
    assert response.status_code == 201, f"Create P1 failed: {response.text}"
    p1 = response.json()
    project_id = p1["id"]
    
    # Create Experiment
    response = client.post(
        f"/api/projects/{project_id}/experiments",
        json={"name": "E1"}
    )
    assert response.status_code == 201
    exp = response.json()
    assert exp["name"] == "E1"
    assert exp["projectId"] == project_id
    assert "publicUrl" in exp
    experiment_id = exp["id"]
    
    # Get Experiments for Project
    response = client.get(f"/api/projects/{project_id}/experiments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == experiment_id
    
    # Update Experiment
    response = client.patch(
        f"/api/experiments/{experiment_id}",
        json={"name": "E1 Updated", "persistTimer": True}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "E1 Updated"
    assert response.json()["persistTimer"] is True
    
    # Delete Experiment
    response = client.delete(f"/api/experiments/{experiment_id}")
    assert response.status_code == 204
    
    # Verify Deletion
    # But wait, there is no GET /api/experiments/{id} in my list.
    # The original routes.ts didn't have GET /api/experiments/{id} except for delete/patch which used ID.
    # It had GET /api/projects/:projectId/experiments.
    # And GET /api/feed/:publicUrl.
    # So I should check list again.
    response = client.get(f"/api/projects/{project_id}/experiments")
    assert response.status_code == 200
    assert len(response.json()) == 0
