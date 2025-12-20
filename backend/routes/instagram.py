
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional, Union
from config import UPLOAD_DIR
from rocketapi import InstagramAPI

router = APIRouter()

class InstagramIngestRequest(BaseModel):
    url: str
    project_id: str
    feed_id: str
    selected_id: Optional[str] = None

class CarouselCandidate(BaseModel):
    id: str
    type: str # "image" or "video"
    url: str # thumbnail/preview URL (remote)

class InstagramIngestResponse(BaseModel):
    type: str = "single" # "single" or "carousel"
    candidates: Optional[List[CarouselCandidate]] = None
    
    # Fields for single media result
    url: Optional[str] = None
    username: Optional[str] = None
    authorAvatar: Optional[str] = None
    authorName: Optional[str] = None
    caption: Optional[str] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None

def download_file(url: str, directory: Path) -> str:
    if not url:
        return ""
    try:
        response = httpx.get(url, timeout=30)
        response.raise_for_status()
        
        # Try to guess extension
        content_type = response.headers.get("content-type", "")
        ext = ".jpg"
        if "video" in content_type:
            ext = ".mp4"
        elif "image/png" in content_type:
            ext = ".png"
            
        filename = f"{uuid.uuid4()}{ext}"
        filepath = directory / filename
        
        with open(filepath, "wb") as f:
            f.write(response.content)
            
        # Return relative path for frontend (assuming /media mount points to UPLOAD_DIR)
        # If directory is UPLOAD_DIR/proj/feed/instagram, and mount is /media -> UPLOAD_DIR
        # Then URL should be /media/proj/feed/instagram/filename
        
        # Calculate relative path from UPLOAD_DIR
        rel_path = filepath.relative_to(UPLOAD_DIR)
        return f"/media/{rel_path}"
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return ""

@router.post("/api/instagram/ingest", response_model=InstagramIngestResponse)
async def ingest_instagram(request: InstagramIngestRequest):
    api_key = os.environ.get("ROCKET_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ROCKET_API_KEY not configured")

    # Extract shortcode
    match = re.search(r"/(?:p|reel|tv)/([A-Za-z0-9_-]+)", request.url)
    if not match:
        raise HTTPException(status_code=400, detail="Could not parse Instagram shortcode from URL")
    
    shortcode = match.group(1)
    
    client = InstagramAPI(token=api_key)
    try:
        # This is a synchronous call in the library, might block event loop slightly but acceptable for this use case
        data = client.get_media_info_by_shortcode(shortcode)
    except Exception as e:
         raise HTTPException(status_code=502, detail=f"RocketAPI error: {str(e)}")

    if data.get("status") != "ok":
        raise HTTPException(status_code=400, detail="RocketAPI returned error status")
        
    response_items = data.get("items", [])
    if not response_items:
        raise HTTPException(status_code=404, detail="Media not found")
        
    media = response_items[0]
    media_type = media.get("media_type")
    
    # Check for Carousel (Type 8)
    if media_type == 8:
        # If no specific ID selected, return candidates
        if not request.selected_id:
            carousel_media = media.get("carousel_media", [])
            candidates = []
            for item in carousel_media:
                # Determine type and thumbnail
                c_type = "image"
                thumb_url = ""
                
                # Check video first
                if "video_versions" in item:
                    c_type = "video"
                    # For video thumbnail, use image_versions2 candidates 0 (highest res cover)
                    if "image_versions2" in item and "candidates" in item["image_versions2"]:
                         thumb_url = item["image_versions2"]["candidates"][0]["url"]
                elif "image_versions2" in item:
                     c_type = "image"
                     if "candidates" in item["image_versions2"]:
                         thumb_url = item["image_versions2"]["candidates"][0]["url"]
                
                candidates.append(CarouselCandidate(
                    id=item.get("id"),
                    type=c_type,
                    url=thumb_url
                ))
            
            return InstagramIngestResponse(type="carousel", candidates=candidates)
        
        # If ID selected, find that item
        carousel_media = media.get("carousel_media", [])
        selected_item = next((item for item in carousel_media if item.get("id") == request.selected_id), None)
        
        if not selected_item:
             raise HTTPException(status_code=404, detail="Selected carousel item not found")
        
        # Treat selected_item as the media to download
        target_media = selected_item
    else:
        # Single item
        target_media = media

    # Extract Data from the main media object (caption, user, metrics are on parent usually)
    # Be careful: for carousel, caption/user/metrics are on the PARENT `media` object, not necessarily the child.
    # The child `selected_item` has the visual content.
    
    # User Info (from Caption object usually, or flat user object on media)
    # The user provided path: response.items[0].caption.user
    caption_obj = media.get("caption", {})
    if caption_obj:
        user_obj = caption_obj.get("user", {})
        caption_text = caption_obj.get("text", "")
    else:
         # Fallback if caption is None (can happen) -> check media.user directly
         user_obj = media.get("user", {})
         caption_text = ""

    username = user_obj.get("username", "")
    full_name = user_obj.get("full_name", "")
    author_avatar_url = user_obj.get("profile_pic_url", "")
    
    # Metrics (from parent media)
    likes = media.get("like_count", 0)
    comments = media.get("comment_count", 0)
    shares = media.get("reshare_count", 0)
    
    # Download Media URL
    media_url = ""
    # Check video
    if "video_versions" in target_media:
        # Highest res is usually first? Or sort by width/height. Sample shows 0 is typically best.
        media_url = target_media["video_versions"][0]["url"]
    elif "image_versions2" in target_media:
        media_url = target_media["image_versions2"]["candidates"][0]["url"]
        
    if not media_url:
        raise HTTPException(status_code=400, detail="Could not retrieve media URL")

    # Download
    # Path: UPLOAD_DIR / project_id / feed_id
    upload_dir = Path(UPLOAD_DIR) / request.project_id / request.feed_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    local_media_url = download_file(media_url, upload_dir)
    local_avatar_url = download_file(author_avatar_url, upload_dir)
    
    if not local_media_url:
         raise HTTPException(status_code=500, detail="Failed to download media file")

    return InstagramIngestResponse(
        type="single",
        url=local_media_url,
        username=username,
        authorAvatar=local_avatar_url,
        authorName=full_name,
        caption=caption_text,
        likes=likes,
        comments=comments,
        shares=shares
    )
