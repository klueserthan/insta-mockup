from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, *, email: str) -> None:
    client.post(
        "/api/register",
        json={"email": email, "password": "password123", "name": "Test", "lastname": "User"},
    )
    resp = client.post("/api/login", json={"email": email, "password": "password123"})
    assert resp.status_code == 200, resp.text


def _create_account(client: TestClient) -> dict:
    resp = client.post(
        "/api/accounts",
        json={
            "username": "user1",
            "displayName": "User One",
            "avatarUrl": "/media/avatar.png",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_get_videos(client: TestClient):
    # Setup
    _register_and_login(client, email="vid@e.com")
    account = _create_account(client)
    p1 = client.post("/api/projects", json={"name": "P1"}).json()
    response = client.post(f"/api/projects/{p1['id']}/experiments", json={"name": "E1"})
    assert response.status_code == 201, f"Create E1 failed: {response.text}"
    e1 = response.json()
    experiment_id = e1["id"]

    # Create Video
    response = client.post(
        f"/api/experiments/{experiment_id}/videos",
        json={
            "filename": "example.mp4",
            "socialAccountId": account["id"],
            "caption": "My Video",
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "song": "Song 1",
        },
    )
    assert response.status_code == 201
    video = response.json()
    assert video["caption"] == "My Video"
    assert video["experimentId"] == experiment_id
    video_id = video["id"]

    # Get Videos
    response = client.get(f"/api/experiments/{experiment_id}/videos")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == video_id

    # Update Video
    response = client.patch(f"/api/videos/{video_id}", json={"likes": 100, "isLocked": True})
    assert response.status_code == 200
    assert response.json()["likes"] == 100
    assert response.json()["isLocked"] is True

    # Delete Video
    response = client.delete(f"/api/videos/{video_id}")
    assert response.status_code == 204

    # Bulk Delete (test later or now? I'll omit for brevity or add if simple)
    # response = client.post("/api/videos/bulk-delete", json={"videoIds": [video_id]})

    # Reorder (test later)
