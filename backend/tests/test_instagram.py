from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


@patch("routes.instagram._download_from_cdn_url")
@patch("routes.instagram.os.environ.get")
@patch("routes.instagram.InstagramAPI")
def test_ingest_instagram_success_single(
    mock_api_class, mock_env_get, mock_download, client: TestClient
):
    mock_env_get.return_value = "fake_key"
    mock_api_instance = mock_api_class.return_value
    mock_download.side_effect = ["avatar.png", "media.mp4"]

    # Mock RocketAPI response for single video
    mock_response = {
        "status": "ok",
        "items": [
            {
                "media_type": 2,  # Video
                "video_versions": [{"url": "http://vid.mp4"}],
                "image_versions2": {"candidates": [{"url": "http://thumb.jpg"}]},
                "caption": {
                    "text": "Test Caption",
                    "user": {
                        "username": "test_user",
                        "full_name": "Test User",
                        "profile_pic_url": "http://avatar.jpg",
                    },
                },
                "like_count": 100,
                "comment_count": 50,
                "reshare_count": 10,
            }
        ],
    }
    mock_api_instance.get_media_info_by_shortcode.return_value = mock_response

    # Must be authenticated (researcher)
    client.post(
        "/api/register",
        json={
            "email": "insta@example.com",
            "password": "password123",
            "name": "I",
            "lastname": "G",
        },
    )
    client.post("/api/login", json={"email": "insta@example.com", "password": "password123"})

    response = client.post(
        "/api/instagram/ingest",
        json={"url": "https://www.instagram.com/reel/Cw12345/"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "single"
    assert data["filename"] == "media.mp4"
    assert data["author"]["username"] == "test_user"
    assert data["author"]["full_name"] == "Test User"
    assert data["author"]["profile_pic_filename"] == "avatar.png"


@patch("httpx.AsyncClient")
def test_proxy_download(mock_client_cls, client: TestClient):
    # Mock AsyncClient context manager
    mock_client = MagicMock()
    mock_client_cls.return_value.__aenter__.return_value = mock_client

    # Mock response stream
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None

    async def mock_aiter_bytes():
        yield b"chunk1"
        yield b"chunk2"

    mock_response.aiter_bytes = mock_aiter_bytes
    mock_client.stream.return_value.__aenter__.return_value = mock_response

    # Since StreamingResponse is async, using TestClient usually works if the app handles it.
    response = client.get("/api/instagram/proxy?url=http://example.com/file")

    assert response.status_code == 200
    assert response.content == b"chunk1chunk2"
