from fastapi.testclient import TestClient

def test_storage_upload_download(client: TestClient):
    # Register/Login
    client.post("/api/register", json={"email": "str@e.com", "password": "p", "name": "S", "lastname": "T"})
    client.post("/api/login", data={"username": "str@e.com", "password": "p"})
    
    # 1. Get Upload URL
    response = client.post("/api/objects/upload")
    assert response.status_code == 200
    data = response.json()
    assert "uploadURL" in data
    upload_url = data["uploadURL"]
    
    # 2. Upload file (PUT)
    # The URL will be something like http://testserver/api/uploads/uuid
    # TestClient can handle relative URLs if valid, or absolute.
    # If the returned URL is full http://..., TestClient usually works if domain matches.
    # backend/routes/storage.py will generate the URL.
    
    # Let's say we implement local storage.
    file_content = b"test content"
    # Parse path from URL
    path = upload_url.replace("http://testserver", "")
    
    response = client.put(path, content=file_content)
    assert response.status_code == 200
    
    # 3. Finalize
    response = client.put(
        "/api/objects/finalize",
        json={"uploadURL": upload_url}
    )
    assert response.status_code == 200
    object_path = response.json()["objectPath"]
    
    # 4. Download
    # /objects/{objectPath}
    response = client.get(f"/objects/{object_path}")
    assert response.status_code == 200
    assert response.content == file_content
