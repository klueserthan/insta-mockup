import os
import re
import uuid
from typing import List, Literal, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rocketapi import InstagramAPI

from auth import get_current_researcher
from config import UPLOAD_DIR

router = APIRouter()


class InstagramIngestRequest(BaseModel):
    url: str


class CarouselCandidate(BaseModel):
    id: str
    type: str  # "image" or "video"
    url: str  # thumbnail/preview URL (remote)


class Author(BaseModel):
    username: str
    full_name: str
    profile_pic_filename: str


class InstagramIngestResponse(BaseModel):
    type: str = "single"  # "single" or "carousel"
    candidates: Optional[List[CarouselCandidate]] = None

    # Fields for single media result
    filename: Optional[str] = None
    author: Optional[Author] = None

    caption: Optional[str] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None


async def _download_from_cdn_url(url: str, media_type: Literal["image", "video"] = "image") -> str:
    """
    Download a file from a CDN URL and save it to the upload directory. Return the filename.
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Generate a unique filename
    extension = "png" if media_type == "image" else "mp4"
    unique_filename = f"{uuid.uuid4()}.{extension}"

    # Determine storage path
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    print(f"Downloading {url} to \n\n{file_path}")
    # Download the file
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30)
            response.raise_for_status()
            with open(file_path, "wb") as f:
                f.write(response.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

    return unique_filename


@router.post("/api/instagram/ingest", response_model=InstagramIngestResponse)
async def ingest_instagram(
    request: InstagramIngestRequest,
    current_user=Depends(get_current_researcher),  # H6: Add authentication
):
    def _check_media_type_of_item(item):
        if "video_versions" in item:
            return "video"
        elif "image_versions2" in item:
            return "image"
        else:
            return None

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

    # Check for Carousel (Type 8)
    if media.get("media_type") == 8:
        # Not implemented yet
        raise HTTPException(status_code=501, detail="Carousel media not implemented yet")

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
    if "video_versions" in media:
        # Highest res is usually first
        media_url = media["video_versions"][0]["url"]
        media_type = "video"
    elif "image_versions2" in media:
        media_url = media["image_versions2"]["candidates"][0]["url"]
        media_type = "image"

    if not media_url:
        raise HTTPException(status_code=400, detail="Could not retrieve media URL")

    author = Author(
        username=username,
        full_name=full_name,
        profile_pic_filename=await _download_from_cdn_url(author_avatar_url, "image"),
    )

    return InstagramIngestResponse(
        type="single",
        filename=await _download_from_cdn_url(media_url, media_type),
        author=author,
        caption=caption_text,
        likes=likes,
        comments=comments,
        shares=shares,
    )


@router.get("/api/instagram/proxy")
async def proxy_download(url: str, current_user=Depends(get_current_researcher)):
    """
    Proxy download from whitelisted CDN domains (H4: secured with auth and domain whitelist).
    Only allows HTTPS URLs from approved Instagram/Facebook CDN domains.
    """
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # H4: Only allow HTTPS
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only HTTPS URLs allowed")

    # H4: Whitelist allowed domains
    allowed_domains = ["cdninstagram.com", "fbcdn.net", "instagram.com"]
    domain = urlparse(url).netloc
    if not any(domain.endswith(d) for d in allowed_domains):
        raise HTTPException(status_code=400, detail=f"Domain not allowed: {domain}")

    async def stream_content():
        async with httpx.AsyncClient() as client:
            try:
                msg = "Proxying content from: " + url
                print(msg)
                async with client.stream(
                    "GET", url, follow_redirects=True, timeout=30.0
                ) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except Exception as e:
                print(f"Proxy error: {e}")
                raise HTTPException(status_code=502, detail="Failed to fetch remote content")

    return StreamingResponse(stream_content())
