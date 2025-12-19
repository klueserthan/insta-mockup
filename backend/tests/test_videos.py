from fastapi.testclient import TestClient

def test_create_get_videos(client: TestClient):
    # Setup
    client.post("/api/register", json={"email": "vid@e.com", "password": "password123", "name": "V", "lastname": "I"})
    l = client.post("/api/login", data={"username": "vid@e.com", "password": "password123"})
    assert l.status_code == 200
    p1 = client.post("/api/projects", json={"name": "P1"}).json()
    response = client.post(f"/api/projects/{p1['id']}/experiments", json={"name": "E1"})
    assert response.status_code == 201, f"Create E1 failed: {response.text}"
    e1 = response.json()
    experiment_id = e1["id"]
    
    # Create Video
    response = client.post(
        f"/api/experiments/{experiment_id}/videos",
        json={
            "url": "http://example.com/video.mp4",
            "username": "user1",
            "userAvatar": "http://example.com/avatar.jpg",
            "caption": "My Video",
            "song": "Song 1"
        }
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
    response = client.patch(
        f"/api/videos/{video_id}",
        json={"likes": 100, "isLocked": True}
    )
    assert response.status_code == 200
    assert response.json()["likes"] == 100
    assert response.json()["isLocked"] is True
    
    # Delete Video
    response = client.delete(f"/api/videos/{video_id}")
    assert response.status_code == 204
    
    # Bulk Delete (test later or now? I'll omit for brevity or add if simple)
    # response = client.post("/api/videos/bulk-delete", json={"videoIds": [video_id]})
    
    # Reorder (test later)
