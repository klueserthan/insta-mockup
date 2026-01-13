from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from auth import get_current_researcher
from database import get_session
from models import (
    CamelModel,
    Experiment,
    PreseededComment,
    PreseededCommentBase,
    Project,
    Researcher,
    Video,
)

router = APIRouter()


# Helper functions for ownership verification
def verify_comment_ownership(session: Session, comment_id: UUID, user_id: UUID) -> PreseededComment:
    """Verify that the user owns the comment (via video → experiment → project). Returns comment if authorized."""
    comment = session.get(PreseededComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    video = session.get(Video, comment.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    experiment = session.get(Experiment, video.experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return comment


def verify_video_ownership(session: Session, video_id: UUID, user_id: UUID) -> Video:
    """Verify that the user owns the video (via experiment → project). Returns video if authorized."""
    video = session.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    experiment = session.get(Experiment, video.experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return video


@router.get("/api/videos/{video_id}/comments", response_model=List[PreseededComment])
def get_comments(
    video_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),  # H7: Add authentication
):
    """
    Get comments for a video. Requires authentication to prevent enumeration.
    Comments are also returned as part of the public feed response for participants.
    """
    # Verify user owns the video (via experiment ownership)
    verify_video_ownership(session, video_id, current_user.id)

    from typing import Any, cast

    comments = session.exec(
        select(PreseededComment)
        .where(PreseededComment.video_id == video_id)
        .order_by(cast(Any, PreseededComment.position))
    ).all()
    return comments


@router.post("/api/videos/{video_id}/comments", response_model=PreseededComment, status_code=201)
def create_comment(
    video_id: UUID,
    comment_base: PreseededCommentBase,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    verify_video_ownership(session, video_id, current_user.id)

    # max pos
    max_pos = (
        session.exec(
            select(func.max(PreseededComment.position)).where(PreseededComment.video_id == video_id)
        ).one()
        or -1
    )

    if max_pos is None:
        max_pos = -1

    comment = PreseededComment(
        **comment_base.dict(exclude={"position"}), video_id=video_id, position=max_pos + 1
    )

    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment


class CommentUpdate(CamelModel):
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    body: Optional[str] = None
    likes: Optional[int] = None
    source: Optional[str] = None
    position: Optional[int] = None


@router.patch("/api/comments/{comment_id}", response_model=PreseededComment)
def update_comment(
    comment_id: UUID,
    comment_update: CommentUpdate,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    db_comment = verify_comment_ownership(session, comment_id, current_user.id)

    for key, value in comment_update.dict(exclude_unset=True).items():
        setattr(db_comment, key, value)

    session.add(db_comment)
    session.commit()
    session.refresh(db_comment)
    return db_comment


@router.delete("/api/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    # Verify ownership and get comment in one step
    # Will raise 404 if not found, 403 if not authorized
    db_comment = verify_comment_ownership(session, comment_id, current_user.id)

    session.delete(db_comment)
    session.commit()
    session.commit()
