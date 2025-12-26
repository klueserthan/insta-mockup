from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, func, select

from auth import get_current_researcher
from database import get_session
from models import (
    CamelModel,
    Experiment,
    Project,
    Researcher,
    SocialAccount,
    SocialAccountBase,
    Video,
    VideoBase,
)

router = APIRouter()


# Helper functions for ownership verification
def verify_experiment_ownership(session: Session, experiment_id: UUID, user_id: UUID) -> Experiment:
    """Verify that the user owns the experiment (via project). Returns experiment if authorized."""
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project or project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return experiment


def verify_video_ownership(session: Session, video_id: UUID, user_id: UUID) -> Video:
    """Verify that the user owns the video (via experiment → project). Returns video if authorized."""
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    # Using join could be more efficient but this is clearer
    experiment = session.get(Experiment, video.experiment_id)
    project = session.get(Project, experiment.project_id)
    if project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return video


class VideoResponse(VideoBase):
    id: UUID
    experiment_id: UUID
    created_at: int  # or datetime
    social_account: SocialAccountBase


@router.get("/api/experiments/{experiment_id}/videos", response_model=List[VideoResponse])
def get_videos(
    experiment_id: UUID,
    session: Session = Depends(get_session),
    # Optional: Allow public access if public feed?
    # Current requirement implies authenticated for management.
    # Public feed is separate route.
    current_user: Researcher = Depends(get_current_researcher),
):
    verify_experiment_ownership(session, experiment_id, current_user.id)
    # Order by position
    videos = session.exec(
        select(Video, SocialAccount)
        .where(Video.experiment_id == experiment_id)
        .join(SocialAccount, Video.social_account_id == SocialAccount.id)
        .order_by(Video.position)
    ).all()
    return videos


@router.post("/api/experiments/{experiment_id}/videos", response_model=Video, status_code=201)
def create_video(
    experiment_id: UUID,
    video_base: VideoBase,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    """Create a new video for an experiment.
    
    Videos are assigned sequential positions starting from 0. The position determines
    the video's default ordering in the feed (before randomization with lock preservation).
    """
    verify_experiment_ownership(session, experiment_id, current_user.id)

    # Ensure this query sees the latest state in the current database session.
    # Flushing makes any pending writes in this session visible to the upcoming
    # max(position) query, and expiring loaded instances forces a refresh from
    # the database so we don't operate on stale in-memory state. This is important
    # in production when multiple changes happen within the same request/transaction,
    # and it also prevents stale reads in tests that reuse a shared session across
    # multiple requests.
    session.flush()
    session.expire_all()
    
    # Calculate max position for this experiment
    max_pos_result = session.exec(
        select(func.max(Video.position)).where(Video.experiment_id == experiment_id)
    ).one()
    
    # .one() returns None if no rows exist, or the max value if rows exist
    max_pos = max_pos_result if max_pos_result is not None else -1

    video = Video(
        **video_base.dict(exclude={"position"}), experiment_id=experiment_id, position=max_pos + 1
    )

    session.add(video)
    session.commit()
    session.refresh(video)
    return video


class VideoUpdate(CamelModel):
    filename: Optional[str] = None
    social_account_id: Optional[UUID] = None
    caption: Optional[str] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    shares: Optional[int] = None
    song: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None
    is_locked: Optional[bool] = None


@router.patch("/api/videos/{video_id}", response_model=Video)
def update_video(
    video_id: UUID,
    video_update: VideoUpdate,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    """Update a video's metadata.
    
    Can update any field including caption, likes, comments, shares, position, and isLocked.
    """
    db_video = verify_video_ownership(session, video_id, current_user.id)

    for key, value in video_update.dict(exclude_unset=True).items():
        setattr(db_video, key, value)

    session.add(db_video)
    session.commit()
    session.refresh(db_video)
    return db_video


@router.delete("/api/videos/{video_id}", status_code=204)
def delete_video(
    video_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    # Verify ownership and get video in one step
    # Will raise 404 if not found, 403 if not authorized
    db_video = verify_video_ownership(session, video_id, current_user.id)

    session.delete(db_video)
    session.commit()


@router.post("/api/videos/bulk-delete", status_code=204)
def bulk_delete_videos(
    video_ids: List[UUID] = Body(..., embed=True, alias="videoIds"),
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    for vid in video_ids:
        db_video = session.get(Video, vid)
        if db_video:
            # Check ownership for each? Or assume if user has rights they can delete.
            # Efficient way: check all belong to experiments owned by user.
            # Lazy way calling verify for each
            try:
                verify_video_ownership(session, vid, current_user.id)
                session.delete(db_video)
            except HTTPException:
                pass  # Ignore if not authorized or not found? Or fail?
                # Original code just promised all `storage.deleteVideo`.
    session.commit()


class VideoReorderRequest(CamelModel):
    experiment_id: UUID
    ordered_video_ids: List[UUID]


@router.post("/api/videos/reorder", status_code=200)
def reorder_videos(
    request: VideoReorderRequest,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    """Reorder videos by providing an ordered list of video IDs. Verifies ownership before updating.

    The position of each video is determined by its index in the orderedVideoIds array.
    All videos in the experiment must be included in the reorder request.
    """
    # Verify experiment ownership
    verify_experiment_ownership(session, request.experiment_id, current_user.id)

    # Fetch all videos for this experiment
    videos = session.exec(select(Video).where(Video.experiment_id == request.experiment_id)).all()

    video_map = {str(v.id): v for v in videos}

    # Allow empty array only if experiment has no videos
    if len(videos) == 0:
        # Valid no-op: reordering an experiment with no videos
        return

    # Validate that all videos in the experiment are included
    if len(request.ordered_video_ids) != len(videos):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "All videos in the experiment must be included in the reorder request",
                "expectedCount": len(videos),
                "providedCount": len(request.ordered_video_ids),
            },
        )

    # Validate no duplicate video IDs
    video_id_strings = [str(vid) for vid in request.ordered_video_ids]
    if len(video_id_strings) != len(set(video_id_strings)):
        raise HTTPException(
            status_code=400,
            detail={"error": "orderedVideoIds contains duplicate video IDs"},
        )

    # Validate all requested video IDs exist and belong to this experiment
    missing_ids: List[str] = []
    for video_id in request.ordered_video_ids:
        video_id_str = str(video_id)
        if video_id_str not in video_map:
            missing_ids.append(video_id_str)

    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "One or more videos do not exist in this experiment",
                "missingVideoIds": missing_ids,
            },
        )

    # Update positions based on order in the list
    for position, video_id in enumerate(request.ordered_video_ids):
        video = video_map[str(video_id)]
        video.position = position
        session.add(video)

    session.commit()
