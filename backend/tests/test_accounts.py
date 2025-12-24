from fastapi.testclient import TestClient

from tests.helpers import auth_headers, register_and_login


def test_accounts(client: TestClient):
    token = register_and_login(client, email="acc@e.com")
    headers = auth_headers(token)

    # Create Account
    response = client.post(
        "/api/accounts",
        json={"username": "ig_user", "displayName": "IG User", "avatarUrl": "http://img"},
        headers=headers,
    )
    assert response.status_code == 201

    # Get Accounts
    response = client.get("/api/accounts", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    acc_id = response.json()[0]["id"]

    # Delete
    response = client.delete(f"/api/accounts/{acc_id}", headers=headers)
    assert response.status_code == 204

    response = client.get("/api/accounts", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0
