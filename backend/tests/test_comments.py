from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def _create_account(client: TestClient, token: str) -> dict:
    resp = client.post(
        "/api/accounts",
        json={
            "username": "commenter",
            "displayName": "Commenter",
            "avatarUrl": "/media/avatar.png",
        },
        headers=auth_headers(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_comments(client: TestClient):
    # Setup
    token = register_and_login(client, email="com@e.com")
    headers = auth_headers(token)
    account = _create_account(client, token)
    p1 = client.post("/api/projects", json={"name": "P1"}, headers=headers).json()
    e1 = client.post(
        f"/api/projects/{p1['id']}/experiments", json={"name": "E1"}, headers=headers
    ).json()
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
        headers=headers,
    ).json()
    vid_id = v1["id"]

    # Create Comment
    response = client.post(
        f"/api/videos/{vid_id}/comments",
        json={"authorName": "Author", "authorAvatar": "http://avatar", "body": "Comment Body"},
        headers=headers,
    )
    assert response.status_code == 201
    comment = response.json()
    assert comment["body"] == "Comment Body"
    com_id = comment["id"]

    # Get Comments
    response = client.get(f"/api/videos/{vid_id}/comments", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

    # Update Comment
    response = client.patch(
        f"/api/comments/{com_id}", json={"body": "Updated Body"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["body"] == "Updated Body"

    # Delete Comment
    response = client.delete(f"/api/comments/{com_id}", headers=headers)
    assert response.status_code == 204
