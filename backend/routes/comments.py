import json
import logging
import random
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from sqlmodel import Session, func, select

from auth import get_current_researcher
from config import OLLAMA_API_TOKEN, OLLAMA_MODEL
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

logger = logging.getLogger(__name__)

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
    Get comments for a video owned by the authenticated researcher. Requires authentication to prevent
    enumeration of comments on videos the researcher does not own.

    Participants do not call this endpoint directly. They receive the same comments as part of the public
    feed response from the `/api/feed/{public_url}` endpoint, which is a separate (unauthenticated) code
    path for participant-facing access.
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


class GenerateCommentsRequest(CamelModel):
    count: int = Field(ge=3, le=15, description="Number of comments to generate (3-15)")
    tone: str = Field(
        pattern="^(positive|negative|mixed)$",
        description="Tone of comments: positive, negative, or mixed",
    )


@router.post(
    "/api/videos/{video_id}/comments/generate",
    response_model=List[PreseededComment],
    status_code=201,
)
async def generate_comments(
    video_id: UUID,
    request: GenerateCommentsRequest,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    """
    Generate AI-powered comments for a video using Ollama Cloud via pydantic-ai.

    Requires OLLAMA_API_TOKEN to be set in environment variables.
    Generates contextual comments based on the video's caption and configured tone.
    """
    # Verify user owns the video
    video = verify_video_ownership(session, video_id, current_user.id)

    # Check if OLLAMA_API_TOKEN is set
    if not OLLAMA_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="AI comment generation is not available. OLLAMA_API_TOKEN environment variable is not set.",
        )

    model_name = OLLAMA_MODEL

    try:
        # Configure Ollama Cloud model via OpenAI-compatible API
        model = OpenAIModel(
            model_name,
            base_url="https://api.ollama.ai/v1",
            api_key=OLLAMA_API_TOKEN,
        )

        # Create agent with system prompt tailored for comment generation
        agent = Agent(model=model)

        # Build the prompt based on tone and caption
        tone_instructions = {
            "positive": "Generate only positive, supportive, and enthusiastic comments.",
            "negative": "Generate critical, skeptical, or negative comments.",
            "mixed": "Generate a realistic mix of positive, neutral, and occasionally critical comments.",
        }

        tone_instruction = tone_instructions.get(request.tone, tone_instructions["mixed"])

        prompt = f"""Generate exactly {request.count} Instagram-style comments for a reel with the caption: "{video.caption}"

{tone_instruction}

Requirements:
- Each comment should be short (1-3 sentences maximum)
- Use casual, social media language
- Include relevant emojis occasionally
- Make comments feel authentic and varied
- Return ONLY a JSON array of strings, nothing else

Example format:
["Great video! 🔥", "Love this content", "Amazing! Keep it up 💯"]

Generate exactly {request.count} comments now:"""

        # Run the AI agent
        result = await agent.run(prompt)

        # Parse the result - expecting JSON array of strings
        try:
            comments_texts = json.loads(result.data)
            if not isinstance(comments_texts, list):
                # If not a list, try to extract from the response
                raise ValueError("Response is not a list")
        except (json.JSONDecodeError, ValueError):
            # Fallback: split by newlines and clean
            lines = str(result.data).strip().split("\n")
            comments_texts = [
                line.strip().strip('"').strip("'").strip() for line in lines if line.strip()
            ]
            # Filter out JSON artifacts
            comments_texts = [
                c
                for c in comments_texts
                if c and not c.startswith("[") and not c.startswith("]") and not c.startswith("{")
            ]

        # Limit to requested count
        comments_texts = comments_texts[: request.count]

        # Generate random usernames and likes for each comment
        username_prefixes = ["user", "fan", "viewer", "follower", "ig", "insta", "real", "the"]
        username_suffixes = ["123", "456", "789", "_official", "_real", "xo", "99", "2024"]

        # Get max position once before the loop
        max_pos = (
            session.exec(
                select(func.max(PreseededComment.position)).where(
                    PreseededComment.video_id == video_id
                )
            ).one()
            or -1
        )

        if max_pos is None:
            max_pos = -1

        created_comments = []
        used_usernames = set()

        for i, comment_text in enumerate(comments_texts):
            # Generate unique random username
            base_username = f"{random.choice(username_prefixes)}_{random.choice(username_suffixes)}"
            username = base_username
            # Ensure uniqueness within this batch
            while username in used_usernames:
                username = f"{base_username}_{random.randint(1000, 9999)}"
            used_usernames.add(username)

            # Generate random likes (weighted toward lower numbers)
            likes = random.choices(
                [0, 1, 2, 3, 5, 10, 25, 50], weights=[10, 15, 12, 10, 8, 5, 2, 1]
            )[0]

            # Create comment with incremental position
            comment = PreseededComment(
                video_id=video_id,
                author_name=username,
                author_avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}_{random.randint(1000, 9999)}",
                body=comment_text,
                likes=likes,
                source="ai",
                position=max_pos + 1 + i,
            )

            session.add(comment)
            created_comments.append(comment)

        session.commit()

        # Refresh all comments to get their IDs
        for comment in created_comments:
            session.refresh(comment)

        return created_comments

    except Exception as e:
        # Log the error server-side without exposing details to client
        logger.error(f"Failed to generate comments for video {video_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate comments. Please try again or contact support if the issue persists.",
        )
