
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)


@patch("os.environ.get")
@patch("routes.instagram.InstagramAPI") 
def test_ingest_instagram_success_single(mock_api_class, mock_env_get):
    mock_env_get.return_value = "fake_key"
    mock_api_instance = mock_api_class.return_value

    # Mock RocketAPI response for single video
    mock_response = {
        "status": "ok",
        "items": [{
            "media_type": 2, # Video
            "video_versions": [{"url": "http://vid.mp4"}],
            "image_versions2": {"candidates": [{"url": "http://thumb.jpg"}]},
            "caption": {
                "text": "Test Caption", 
                "user": {
                    "username": "test_user", 
                    "full_name": "Test User", 
                    "profile_pic_url": "http://avatar.jpg"
                }
            },
            "like_count": 100,
            "comment_count": 50,
            "reshare_count": 10
        }]
    }
    mock_api_instance.get_media_info_by_shortcode.return_value = mock_response
    
    response = client.post("/api/instagram/ingest", json={
        "url": "https://www.instagram.com/reel/Cw12345/",
        "project_id": "123e4567-e89b-12d3-a456-426614174000",
        "feed_id": "123e4567-e89b-12d3-a456-426614174001"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "single"
    assert data["source_url"] == "http://vid.mp4"
    assert data["author"]["username"] == "test_user"
    assert data["author"]["full_name"] == "Test User"
    assert data["author"]["profile_pic_url"] == "http://avatar.jpg"


@patch("os.environ.get")
@patch("routes.instagram.InstagramAPI")
def test_ingest_instagram_carousel_candidates(mock_api_class, mock_env_get):
    mock_env_get.return_value = "fake_key"
    mock_api_instance = mock_api_class.return_value
    
    # Mock RocketAPI response for carousel
    mock_response = {
        "status": "ok",
        "items": [{
            "media_type": 8, # Carousel
            "carousel_media": [
                {
                    "id": "123",
                    "image_versions2": {"candidates": [{"url": "http://img1.jpg"}]}
                },
                {
                    "id": "456",
                    "video_versions": [{"url": "http://vid1.mp4"}],
                    "image_versions2": {"candidates": [{"url": "http://vid1_thumb.jpg"}]}
                }
            ],
            "caption": {"text": "Carousel Caption", "user": {"username": "c_user"}},
        }]
    }
    mock_api_instance.get_media_info_by_shortcode.return_value = mock_response
    
    # First call: No selected_id
    response = client.post("/api/instagram/ingest", json={
        "url": "https://www.instagram.com/p/Carr123/",
        "project_id": "123e4567-e89b-12d3-a456-426614174000",
        "feed_id": "123e4567-e89b-12d3-a456-426614174001"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "carousel"
    assert len(data["candidates"]) == 2


@patch("os.environ.get")
@patch("routes.instagram.InstagramAPI")
def test_ingest_instagram_carousel_selection(mock_api_class, mock_env_get):
    mock_env_get.return_value = "fake_key"
    mock_api_instance = mock_api_class.return_value
    
    # Mock RocketAPI response for carousel (same as above)
    mock_response = {
        "status": "ok",
        "items": [{
            "media_type": 8, # Carousel
            "caption": {
                "text": "Carousel Caption",
                "user": {
                    "username": "c_user",
                    "full_name": "C User",
                    "profile_pic_url": "http://avatar.jpg"
                }
            },
            "like_count": 200,
            "comment_count": 20,
            "reshare_count": 5,
            "carousel_media": [
                {
                    "id": "123", # Image
                    "image_versions2": {"candidates": [{"url": "http://img1.jpg"}]}
                },
                {
                    "id": "456", # Video
                    "video_versions": [{"url": "http://vid1.mp4"}],
                    "image_versions2": {"candidates": [{"url": "http://vid1_thumb.jpg"}]}
                }
            ]
        }]
    }
    mock_api_instance.get_media_info_by_shortcode.return_value = mock_response
    
    # Second call: With selected_id "123" (Image)
    response = client.post("/api/instagram/ingest", json={
        "url": "https://www.instagram.com/p/Carr123/", 
        "selected_id": "123",
        "project_id": "123e4567-e89b-12d3-a456-426614174000",
        "feed_id": "123e4567-e89b-12d3-a456-426614174001"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "single"
    assert "source_url" in data
    assert data["source_url"] == "http://img1.jpg"
    assert data["author"]["username"] == "c_user"
    assert data["author"]["full_name"] == "C User"
    assert data["author"]["profile_pic_url"] == "http://avatar.jpg"

@patch("httpx.AsyncClient")
def test_proxy_download(mock_client_cls):
    # Mock AsyncClient context manager
    mock_client = MagicMock()
    mock_client_cls.return_value.__aenter__.return_value = mock_client
    
    # Mock response stream
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    
    async def mock_aiter_bytes():
        yield b'chunk1'
        yield b'chunk2'
    
    mock_response.aiter_bytes = mock_aiter_bytes
    mock_client.stream.return_value.__aenter__.return_value = mock_response
    
    # Since StreamingResponse is async, using TestClient usually works if the app handles it.
    response = client.get("/api/instagram/proxy?url=http://example.com/file")
    
    assert response.status_code == 200
    assert response.content == b'chunk1chunk2'
