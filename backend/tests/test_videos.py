from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def _create_account(client: TestClient, token: str) -> dict:
    resp = client.post(
        "/api/accounts",
        json={
            "username": "user1",
            "displayName": "User One",
            "avatarUrl": "/media/avatar.png",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_get_videos(client: TestClient):
    # Setup
    token = register_and_login(client, email="vid@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    response = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    )
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
        headers=headers,
    )
    assert response.status_code == 201
    video = response.json()
    assert video["caption"] == "My Video"
    assert video["experimentId"] == experiment_id
    video_id = video["id"]

    # Get Videos
    response = client.get(f"/api/experiments/{experiment_id}/videos", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == video_id

    # Update Video
    response = client.patch(
        f"/api/videos/{video_id}", json={"likes": 100, "isLocked": True}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["likes"] == 100
    assert response.json()["isLocked"] is True

    # Delete Video
    response = client.delete(f"/api/videos/{video_id}", headers=headers)
    assert response.status_code == 204

    # Bulk Delete (test later or now? I'll omit for brevity or add if simple)
    # response = client.post("/api/videos/bulk-delete", json={"videoIds": [video_id]})

    # Reorder (test later)
