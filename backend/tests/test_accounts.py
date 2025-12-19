from fastapi.testclient import TestClient

def test_accounts(client: TestClient):
    client.post("/api/register", json={"email": "acc@e.com", "password": "p", "name": "A", "lastname": "C"})
    client.post("/api/login", data={"username": "acc@e.com", "password": "p"})
    
    # Create Account
    response = client.post(
        "/api/accounts",
        json={
            "username": "ig_user",
            "displayName": "IG User",
            "avatarUrl": "http://img"
        }
    )
    assert response.status_code == 201
    
    # Get Accounts
    response = client.get("/api/accounts")
    assert response.status_code == 200
    assert len(response.json()) == 1
    acc_id = response.json()[0]["id"]
    
    # Delete
    response = client.delete(f"/api/accounts/{acc_id}")
    assert response.status_code == 204
    
    response = client.get("/api/accounts")
    assert response.status_code == 200
    assert len(response.json()) == 0
