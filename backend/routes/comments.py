import asyncio
import logging
import random
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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


# Pydantic model for structured agent output
class GeneratedComment(BaseModel):
    """Structured output from AI agent for a single comment."""

    body: str = Field(description="The comment text (1-3 sentences, casual social media language)")
    username: str = Field(description="A realistic Instagram username")
    likes: int = Field(ge=0, le=100, description="Number of likes for this comment (0-100)")


# Dependencies for the agent
class CommentGenerationDeps(BaseModel):
    """Dependencies passed to the agent for comment generation."""

    caption: str = Field(description="The video caption to comment on")
    tone_instruction: str = Field(description="Instructions for the tone of the comment")


# System prompt for the comment generation agent
COMMENT_AGENT_SYSTEM_PROMPT = """You are an AI assistant that generates authentic Instagram-style comments for reels.

Your task is to create ONE realistic comment that someone might leave on an Instagram reel.

Guidelines:
- Keep comments short (1-3 sentences maximum)
- Use casual, social media language
- Include emojis occasionally when appropriate
- Make the comment feel authentic and natural
- Follow the tone instructions provided
- Generate a realistic Instagram username (e.g., user_123, ig_real, fan_official)
- Assign a realistic number of likes (typically 0-50, occasionally up to 100)

You will receive:
1. The video caption
2. Tone instructions (positive, negative, or mixed)

You must respond with:
1. body: The comment text
2. username: A realistic Instagram username
3. likes: Number of likes (0-100, weighted toward lower numbers)"""


# Singleton agent instance - created once at module level
def _create_comment_agent() -> Agent[CommentGenerationDeps, GeneratedComment] | None:
    """Create the comment generation agent singleton."""
    if not OLLAMA_API_TOKEN:
        return None

    try:
        model = OpenAIModel(
            OLLAMA_MODEL,
            base_url="https://api.ollama.ai/v1",
            api_key=OLLAMA_API_TOKEN,
        )

        return Agent(
            model=model,
            result_type=GeneratedComment,
            system_prompt=COMMENT_AGENT_SYSTEM_PROMPT,
        )
    except Exception as e:
        logger.warning(f"Failed to create comment agent: {e}")
        return None


# Singleton instance
_comment_agent = _create_comment_agent()


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
    Each comment is generated individually by calling the agent multiple times in parallel.
    """
    # Verify user owns the video
    video = verify_video_ownership(session, video_id, current_user.id)

    # Check if agent is available (OLLAMA_API_TOKEN must be set)
    if _comment_agent is None:
        raise HTTPException(
            status_code=503,
            detail="AI comment generation is not available. OLLAMA_API_TOKEN environment variable is not set.",
        )

    try:
        # Build the tone instructions based on request
        tone_instructions = {
            "positive": "Generate a positive, supportive, and enthusiastic comment.",
            "negative": "Generate a critical, skeptical, or negative comment.",
            "mixed": "Generate a realistic comment that could be positive, neutral, or occasionally critical.",
        }

        tone_instruction = tone_instructions.get(request.tone, tone_instructions["mixed"])

        # Get max position once before generating comments
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

        # Prepare tasks for parallel execution
        async def generate_single_comment(index: int) -> GeneratedComment:
            """Generate a single comment using the agent."""
            deps = CommentGenerationDeps(
                caption=video.caption,
                tone_instruction=tone_instruction,
            )
            prompt = f"Generate a comment for a reel with this caption: '{video.caption}'"
            result = await _comment_agent.run(prompt, deps=deps)
            return result.data

        # Generate all comments in parallel
        tasks = [generate_single_comment(i) for i in range(request.count)]
        generated_comments = await asyncio.gather(*tasks)

        # Process generated comments and create database records
        created_comments = []
        used_usernames = set()

        for i, generated in enumerate(generated_comments):
            # Ensure username uniqueness within this batch
            username = generated.username
            if username in used_usernames:
                # Append random suffix to make it unique
                username = f"{username}_{random.randint(1000, 9999)}"
            used_usernames.add(username)

            # Create comment with incremental position
            comment = PreseededComment(
                video_id=video_id,
                author_name=username,
                author_avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}_{random.randint(1000, 9999)}",
                body=generated.body,
                likes=generated.likes,
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
