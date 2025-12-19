from fastapi.testclient import TestClient

def test_comments(client: TestClient):
    # Setup
    client.post("/api/register", json={"email": "com@e.com", "password": "p", "name": "C", "lastname": "M"})
    client.post("/api/login", data={"username": "com@e.com", "password": "p"})
    p1 = client.post("/api/projects", json={"name": "P1"}).json()
    e1 = client.post(f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}).json()
    v1 = client.post(f"/api/experiments/{e1['id']}/videos", json={"url": "v.mp4", "username": "u", "user_avatar": "a", "caption": "c", "song": "s"}).json()
    vid_id = v1["id"]

    # Create Comment
    response = client.post(
        f"/api/videos/{vid_id}/comments",
        json={
            "authorName": "Author",
            "authorAvatar": "http://avatar",
            "body": "Comment Body"
        }
    )
    assert response.status_code == 201
    comment = response.json()
    assert comment["body"] == "Comment Body"
    com_id = comment["id"]
    
    # Get Comments
    response = client.get(f"/api/videos/{vid_id}/comments")
    assert response.status_code == 200
    assert len(response.json()) == 1
    
    # Update Comment
    response = client.patch(
        f"/api/comments/{com_id}",
        json={"body": "Updated Body"}
    )
    assert response.status_code == 200
    assert response.json()["body"] == "Updated Body"
    
    # Delete Comment
    response = client.delete(f"/api/comments/{com_id}")
    assert response.status_code == 204
