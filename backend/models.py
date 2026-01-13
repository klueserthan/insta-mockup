from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, cast
from uuid import UUID, uuid4

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import JSON, Field, Relationship, SQLModel


class CamelModel(SQLModel):
    model_config = cast(
        Any,
        ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True),
    )


# Researcher
class ResearcherBase(CamelModel):
    email: str = Field(unique=True, index=True)
    name: str
    lastname: str


class Researcher(ResearcherBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    projects: Optional[List["Project"]] = Relationship(back_populates="researcher")
    social_accounts: Optional[List["SocialAccount"]] = Relationship(back_populates="researcher")


# Project
class ProjectBase(CamelModel):
    name: str
    query_key: str = Field(default="participantId")
    time_limit_seconds: int = Field(default=300)
    redirect_url: str = Field(default="")
    end_screen_message: str = Field(
        default="Thank you for participating in this study. You will be redirected shortly."
    )
    lock_all_positions: bool = Field(default=False)
    randomization_seed: int = Field(default=42)


class Project(ProjectBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    researcher_id: UUID = Field(foreign_key="researcher.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    researcher: Optional["Researcher"] = Relationship(back_populates="projects")
    experiments: Optional[List["Experiment"]] = Relationship(back_populates="project")


# Experiment
class ExperimentBase(CamelModel):
    name: str
    public_url: str = Field(unique=True)
    persist_timer: bool = Field(default=False)
    show_unmute_prompt: bool = Field(default=True)
    is_active: bool = Field(default=False)


class Experiment(ExperimentBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional["Project"] = Relationship(back_populates="experiments")
    videos: Optional[List["Video"]] = Relationship(back_populates="experiment")
    participants: Optional[List["Participant"]] = Relationship(back_populates="experiment")


# Video
class VideoBase(CamelModel):
    filename: str
    caption: str
    likes: int = Field(default=0)
    comments: int = Field(default=0)
    shares: int = Field(default=0)
    song: str
    description: Optional[str] = None
    position: int = Field(default=0)
    is_locked: bool = Field(default=False)
    social_account_id: UUID = Field(foreign_key="socialaccount.id")


class Video(VideoBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    experiment_id: UUID = Field(foreign_key="experiment.id")
    # social_account_id is in Base now

    created_at: datetime = Field(default_factory=datetime.utcnow)

    experiment: Optional["Experiment"] = Relationship(back_populates="videos")
    social_account: Optional["SocialAccount"] = Relationship()
    preseeded_comments: Optional[List["PreseededComment"]] = Relationship(back_populates="video")


# Participant
class Participant(CamelModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    experiment_id: UUID = Field(foreign_key="experiment.id")
    participant_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    experiment: Optional["Experiment"] = Relationship(back_populates="participants")


# Interaction
class Interaction(CamelModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    participant_uuid: UUID = Field(foreign_key="participant.id")
    video_id: UUID = Field(foreign_key="video.id")
    interaction_type: str
    interaction_data: Optional[Dict] = Field(default=None, sa_type=JSON)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# PreseededComment
class PreseededCommentBase(CamelModel):
    author_name: str
    author_avatar: str
    body: str
    likes: int = Field(default=0)
    source: str = Field(default="manual")
    position: int = Field(default=0)


class PreseededComment(PreseededCommentBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    video_id: UUID = Field(foreign_key="video.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    video: Optional["Video"] = Relationship(back_populates="preseeded_comments")


# SocialAccount
class SocialAccountBase(CamelModel):
    username: str = Field(unique=True)
    display_name: str
    avatar_url: str


class SocialAccount(SocialAccountBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    researcher_id: UUID = Field(foreign_key="researcher.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    researcher: Optional["Researcher"] = Relationship(back_populates="social_accounts")


# ViewSession
class ViewSession(CamelModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(index=True)  # Generated by frontend
    participant_id: str = Field(index=True)  # ID string, not necessarily UUID FK if user is anon
    video_id: UUID = Field(foreign_key="video.id")
    start_time: datetime = Field(default_factory=datetime.utcnow)
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: float = Field(default=0.0)

    video: Optional["Video"] = Relationship()


# Results models (US5)
class ParticipantSessionSummary(CamelModel):
    """Summary of a participant session."""

    participant_id: str
    started_at: str
    ended_at: Optional[str] = None
    total_duration_ms: Optional[int] = None


class ResultsSummary(CamelModel):
    """Summary of results for an experiment."""

    experiment_id: str
    sessions: List[ParticipantSessionSummary]


class ExportRequest(CamelModel):
    """Request for exporting results."""

    format: Literal["csv", "json"]  # Restrict to valid formats
    participant_ids: Optional[List[str]] = None
    include_interactions: bool = True
