import hashlib
import random
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models import Experiment, Project, SocialAccount, Video, VideoBase


class FeedVideoResponse(VideoBase):
    id: UUID
    experiment_id: UUID
    created_at: datetime
    social_account: Optional[SocialAccount] = None


router = APIRouter()


def _randomize_videos_with_locks(
    videos: list[tuple[Video, SocialAccount]],
    participant_id: str,
    randomization_seed: int,
) -> list[tuple[Video, SocialAccount]]:
    """
    Randomize unlocked videos while preserving locked video positions.
    
    Args:
        videos: List of (Video, SocialAccount) tuples ordered by position
        participant_id: Unique participant identifier for consistent randomization
        randomization_seed: Project-level seed for randomization
    
    Returns:
        Reordered list with locked videos at their positions and unlocked videos randomized
    """
    # Preview mode or no participant ID: return videos in their default order
    if not participant_id or participant_id == "preview":
        return videos
    
    # If no videos, return empty list
    if not videos:
        return []
    
    # Separate locked and unlocked videos
    locked_videos: dict[int, tuple[Video, SocialAccount]] = {}
    unlocked_videos: list[tuple[Video, SocialAccount]] = []
    
    for video, account in videos:
        if video.is_locked:
            locked_videos[video.position] = (video, account)
        else:
            unlocked_videos.append((video, account))
    
    # If all videos are locked or no unlocked videos, return in original order
    if len(unlocked_videos) == 0:
        return videos
    
    # Create a deterministic seed for this participant
    # Combine project seed and participant ID for consistent but unique ordering per participant
    seed_string = f"{randomization_seed}-{participant_id}"
    seed_hash = hashlib.md5(seed_string.encode()).hexdigest()
    seed_value = int(seed_hash[:8], 16)  # Use first 8 hex chars as integer seed
    
    # Randomize unlocked videos with the participant-specific seed
    rng = random.Random(seed_value)
    rng.shuffle(unlocked_videos)
    
    # Build final ordered list by filling in slots
    # Start with all videos in a result array indexed by their original position
    result = [None] * len(videos)
    
    # First, place locked videos at their specified positions
    for position, video_tuple in locked_videos.items():
        if position < len(result):
            result[position] = video_tuple
    
    # Fill remaining slots with randomized unlocked videos
    unlocked_idx = 0
    for i in range(len(result)):
        if result[i] is None:
            if unlocked_idx < len(unlocked_videos):
                result[i] = unlocked_videos[unlocked_idx]
                unlocked_idx += 1
    
    # Filter out any None values (shouldn't happen but safety check)
    return [v for v in result if v is not None]


@router.get("/api/feed/{public_url}")
def get_public_feed(
    public_url: str,
    participantId: Optional[str] = None,  # noqa: N803 - camelCase for API consistency
    session: Session = Depends(get_session),
):
    # 1. Find Experiment by public_url
    experiment = session.exec(select(Experiment).where(Experiment.public_url == public_url)).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Feed not found")

    # 2. Check if experiment is active (kill switch)
    if not experiment.is_active:
        raise HTTPException(
            status_code=403,
            detail="This study is not currently active.",
        )

    # 3. Get Videos for this experiment with SocialAccount, ordered by position
    results = session.exec(
        select(Video, SocialAccount)
        .join(SocialAccount)
        .where(Video.experiment_id == experiment.id)
        .order_by(Video.position)
    ).all()

    # Fetch project for settings
    project = experiment.project
    if not project:
        project = session.get(Project, experiment.project_id)

    # 4. Apply randomization with lock preservation
    # Use participantId for deterministic per-participant randomization
    # If no participantId provided, use "preview" as default (no randomization)
    effective_participant_id = participantId if participantId else "preview"
    randomization_seed = project.randomization_seed if project else 42
    
    ordered_videos = _randomize_videos_with_locks(
        results, effective_participant_id, randomization_seed
    )

    return {
        "experimentId": experiment.id,
        "experimentName": experiment.name,
        "persistTimer": experiment.persist_timer,
        "showUnmutePrompt": experiment.show_unmute_prompt,
        "projectSettings": {
            "queryKey": project.query_key if project else "participantId",
            "timeLimitSeconds": project.time_limit_seconds if project else 300,
            "redirectUrl": project.redirect_url if project else "",
            "endScreenMessage": project.end_screen_message
            if project
            else "Thank you for participating.",
        },
        "videos": [
            FeedVideoResponse(**video.model_dump(), social_account=account)
            for video, account in ordered_videos
        ],
    }
