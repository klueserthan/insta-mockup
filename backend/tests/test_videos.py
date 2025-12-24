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


def test_reorder_videos(client: TestClient):
    """Test that videos can be reordered via the API and positions persist correctly."""
    # Setup
    token = register_and_login(client, email="reorder@test.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
    
    # Create three videos
    videos = []
    for i in range(3):
        response = client.post(
            f"/api/experiments/{e1['id']}/videos",
            json={
                "filename": f"video{i}.mp4",
                "socialAccountId": account["id"],
                "caption": f"Video {i}",
                "likes": 0,
                "comments": 0,
                "shares": 0,
                "song": "Song",
            },
            headers=headers,
        )
        assert response.status_code == 201
        videos.append(response.json())
    
    # Verify initial order
    response = client.get(f"/api/experiments/{e1['id']}/videos", headers=headers)
    assert response.status_code == 200
    initial_videos = response.json()
    assert len(initial_videos) == 3
    assert initial_videos[0]["caption"] == "Video 0"
    assert initial_videos[1]["caption"] == "Video 1"
    assert initial_videos[2]["caption"] == "Video 2"
    
    # Reorder: move video 2 to position 0, video 0 to position 1, video 1 to position 2
    reorder_payload = {
        "updates": [
            {"id": videos[2]["id"], "position": 0},
            {"id": videos[0]["id"], "position": 1},
            {"id": videos[1]["id"], "position": 2},
        ]
    }
    response = client.post("/api/videos/reorder", json=reorder_payload, headers=headers)
    assert response.status_code == 200
    
    # Verify new order
    response = client.get(f"/api/experiments/{e1['id']}/videos", headers=headers)
    assert response.status_code == 200
    reordered_videos = response.json()
    assert len(reordered_videos) == 3
    assert reordered_videos[0]["caption"] == "Video 2"
    assert reordered_videos[1]["caption"] == "Video 0"
    assert reordered_videos[2]["caption"] == "Video 1"
