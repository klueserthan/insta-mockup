from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID

from database import get_session
from models import Experiment, Video, Participant
# We might need a PublicVideo model if we want to hide some fields, but Video is probably fine for now.

router = APIRouter()

@router.get("/api/feed/{public_url}")
def get_public_feed(
    public_url: str,
    participantId: Optional[str] = None,
    session: Session = Depends(get_session)
):
    # 1. Find Experiment by public_url
    experiment = session.exec(select(Experiment).where(Experiment.public_url == public_url)).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Feed not found")

    # 2. Get Videos for this experiment
    # Order by position
    videos = session.exec(
        select(Video)
        .where(Video.experiment_id == experiment.id)
        .order_by(Video.position)
    ).all()
    
    # 3. Handle Participant (Optional for now, but good to track)
    if participantId and participantId != "preview":
        # Check if participant exists or create?
        # For strict tracking, we might want to ensure participant exists.
        # But for the feed GET, usually we just assume valid ID or create implicit.
        pass

    # Fetch project for settings
    # Assuming relationship is lazy loaded or not explicitly joined in this session query for simplicity
    # but accessing it might trigger lazy load if relationship defined, or we explicit query.
    # Experiment model has 'project' relationship.
    
    project = experiment.project
    if not project:
         # Explicit fetch if relationship not loaded
         from models import Project
         project = session.get(Project, experiment.project_id)

    return {
        "experimentId": experiment.id,
        "experimentName": experiment.name,
        "persistTimer": experiment.persist_timer,
        "showUnmutePrompt": experiment.show_unmute_prompt,
        "projectSettings": {
            "queryKey": project.query_key if project else "participantId",
            "timeLimitSeconds": project.time_limit_seconds if project else 300,
            "redirectUrl": project.redirect_url if project else "",
            "endScreenMessage": project.end_screen_message if project else "Thank you for participating.",
        },
        "videos": videos,
    }
