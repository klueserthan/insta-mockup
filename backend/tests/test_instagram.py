
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
from config import UPLOAD_DIR
from pathlib import Path

client = TestClient(app)

@patch("os.environ.get")
@patch("routes.instagram.InstagramAPI") 
@patch("routes.instagram.download_file")
def test_ingest_instagram_success_single(mock_download, mock_api_class, mock_env_get):
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
    
    # Mock download return values (relative paths from main mount)
    # Target: /media/p1/f1/filename
    mock_download.side_effect = ["/media/p1/f1/video.mp4", "/media/p1/f1/avatar.jpg"]
    
    response = client.post("/api/instagram/ingest", json={
        "url": "https://www.instagram.com/reel/Cw12345/",
        "project_id": "p1",
        "feed_id": "f1"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "single"
    assert data["username"] == "test_user"
    assert data["url"] == "/media/p1/f1/video.mp4"
    assert data["authorAvatar"] == "/media/p1/f1/avatar.jpg"


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
        "project_id": "p1",
        "feed_id": "f1"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "carousel"
    assert len(data["candidates"]) == 2


@patch("os.environ.get")
@patch("routes.instagram.InstagramAPI")
@patch("routes.instagram.download_file")
def test_ingest_instagram_carousel_selection(mock_download, mock_api_class, mock_env_get):
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
    
    # Stub download
    mock_download.side_effect = ["/media/p1/f1/img1.jpg", "/media/p1/f1/avatar.jpg"]
    
    # Second call: With selected_id "123" (Image)
    response = client.post("/api/instagram/ingest", json={
        "url": "https://www.instagram.com/p/Carr123/", 
        "selected_id": "123",
        "project_id": "p1",
        "feed_id": "f1"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "single"
    assert data["url"] == "/media/p1/f1/img1.jpg"

