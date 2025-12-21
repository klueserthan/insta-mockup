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
            "username": "commenter",
            "displayName": "Commenter",
            "avatarUrl": "/media/avatar.png",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_comments(client: TestClient):
    # Setup
    _register_and_login(client, email="com@e.com")
    account = _create_account(client)
    p1 = client.post("/api/projects", json={"name": "P1"}).json()
    e1 = client.post(f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}).json()
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
    ).json()
    vid_id = v1["id"]

    # Create Comment
    response = client.post(
        f"/api/videos/{vid_id}/comments",
        json={"authorName": "Author", "authorAvatar": "http://avatar", "body": "Comment Body"},
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
    response = client.patch(f"/api/comments/{com_id}", json={"body": "Updated Body"})
    assert response.status_code == 200
    assert response.json()["body"] == "Updated Body"

    # Delete Comment
    response = client.delete(f"/api/comments/{com_id}")
    assert response.status_code == 204
