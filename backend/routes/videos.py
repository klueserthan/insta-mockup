from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select, func
from typing import List, Optional
from uuid import UUID

from database import get_session
from models import Video, VideoBase, Experiment, Project, Researcher, CamelModel, SocialAccountBase
from auth import get_current_user

router = APIRouter()

# Helper
def verify_experiment_ownership(session: Session, experiment_id: UUID, user_id: UUID):
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project or project.researcher_id != user_id:
         raise HTTPException(status_code=403, detail="Not authorized")
    return experiment

def verify_video_ownership(session: Session, video_id: UUID, user_id: UUID):
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
    created_at: int # or datetime
    social_account: SocialAccountBase


@router.get("/api/experiments/{experiment_id}/videos", response_model=List[VideoResponse])
def get_videos(
    experiment_id: UUID,
    session: Session = Depends(get_session),
    # Optional: Allow public access if public feed? 
    # Current requirement implies authenticated for management.
    # Public feed is separate route.
    current_user: Researcher = Depends(get_current_user) 
):
    verify_experiment_ownership(session, experiment_id, current_user.id)
    # Order by position
    videos = (
        session.exec(select(Video, SocialAccount)
        .where(Video.experiment_id == experiment_id)
        .join(SocialAccount, Video.social_account_id == SocialAccount.id)
        .order_by(Video.position)).all()
    )
    return videos

@router.post("/api/experiments/{experiment_id}/videos", response_model=Video, status_code=201)
def create_video(
    experiment_id: UUID,
    video_base: VideoBase,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    verify_experiment_ownership(session, experiment_id, current_user.id)
    
    # Calculate max position
    max_pos = session.exec(
        select(func.max(Video.position)).where(Video.experiment_id == experiment_id)
    ).one() or -1
    
    # If max_pos is None (no videos), it returns None, so make it -1
    if max_pos is None: max_pos = -1
    
    video = Video(**video_base.dict(exclude={"position"}), experiment_id=experiment_id, position=max_pos + 1)
    
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
    current_user: Researcher = Depends(get_current_user)
):
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
    current_user: Researcher = Depends(get_current_user)
):
    db_video = session.get(Video, video_id)
    if not db_video:
        return
        
    verify_video_ownership(session, video_id, current_user.id)
    
    session.delete(db_video)
    session.commit()

@router.post("/api/videos/bulk-delete", status_code=204)
def bulk_delete_videos(
    video_ids: List[UUID] = Body(..., embed=True, alias="videoIds"),
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
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
                pass # Ignore if not authorized or not found? Or fail? 
                # Original code just promised all `storage.deleteVideo`.
    session.commit()

@router.post("/api/videos/reorder", status_code=200)
def reorder_videos(
    updates: List[dict], # Should be validation model really
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    for update in updates:
        vid = update.get("id")
        pos = update.get("position")
        if vid is not None and pos is not None:
             db_video = session.get(Video, vid)
             if db_video:
                 # Check ownership
                 # verify_video_ownership(session, vid, current_user.id) 
                 # Optimization: skip check for now or assume batch belongs to same context
                 try:
                    verify_video_ownership(session, UUID(str(vid)), current_user.id)
                    db_video.position = pos
                    session.add(db_video)
                 except: pass
    session.commit()
