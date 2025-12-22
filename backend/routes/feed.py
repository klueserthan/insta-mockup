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


@router.get("/api/feed/{public_url}")
def get_public_feed(
    public_url: str, participantId: Optional[str] = None, session: Session = Depends(get_session)
):
    # 1. Find Experiment by public_url
    experiment = session.exec(select(Experiment).where(Experiment.public_url == public_url)).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Feed not found")

    # 2. Check if experiment is active (kill switch)
    if not experiment.is_active:
        raise HTTPException(
            status_code=403,
            detail="This study is not currently active. Please contact the researcher for more information."
        )

    # 3. Get Videos for this experiment with SocialAccount
    results = session.exec(
        select(Video, SocialAccount)
        .join(SocialAccount)
        .where(Video.experiment_id == experiment.id)
        .order_by(Video.position)
    ).all()

    # 4. Handle Participant (Optional for now, but good to track)
    if participantId and participantId != "preview":
        pass

    # Fetch project for settings
    project = experiment.project
    if not project:
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
            "endScreenMessage": project.end_screen_message
            if project
            else "Thank you for participating.",
        },
        "videos": [
            FeedVideoResponse(**video.model_dump(), social_account=account)
            for video, account in results
        ],
    }
