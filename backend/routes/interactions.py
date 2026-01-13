import csv
import io
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from auth import get_current_researcher
from database import get_session
from models import (
    CamelModel,
    ExportRequest,
    Interaction,
    Participant,
    ParticipantSessionSummary,
    ResultsSummary,
)
from routes.experiments import verify_experiment_ownership

# We assume implicit participant tracking for now, or use the participantId passed in body.


class InteractionCreate(CamelModel):
    participant_id: str
    experiment_id: UUID
    video_id: UUID
    interaction_type: str
    interaction_data: Optional[Dict[str, Any]] = None  # Renamed from metadata to avoid shadow


router = APIRouter()


@router.post("/api/interactions", status_code=201)
def log_interaction(interaction: InteractionCreate, session: Session = Depends(get_session)):
    # 1. Ensure participant exists or find their ID
    # In the current model, Participant is linked to experiment.
    # We first try to find the participant by their ID string and experiment ID

    from sqlmodel import select

    db_participant = session.exec(
        select(Participant).where(
            Participant.participant_id == interaction.participant_id,
            Participant.experiment_id == interaction.experiment_id,
        )
    ).first()

    if not db_participant:
        # Auto-enroll/create participant if not exists?
        # Typically yes for this kind of public feed logging.
        db_participant = Participant(
            participant_id=interaction.participant_id, experiment_id=interaction.experiment_id
        )
        session.add(db_participant)
        session.commit()
        session.refresh(db_participant)

    # 2. Log Interaction
    db_interaction = Interaction(
        participant_uuid=db_participant.id,
        video_id=interaction.video_id,
        interaction_type=interaction.interaction_type,
        interaction_data=interaction.interaction_data,
    )

    session.add(db_interaction)
    session.commit()
    return {"status": "ok"}


class Heartbeat(CamelModel):
    session_id: UUID
    participant_id: str
    video_id: UUID
    duration_ms: int


@router.post("/api/interactions/heartbeat", status_code=200)
def heartbeat(data: Heartbeat, session: Session = Depends(get_session)):
    from datetime import datetime

    # Try to find existing session
    from sqlmodel import select

    from models import ViewSession

    view_session = session.exec(
        select(ViewSession).where(ViewSession.session_id == data.session_id)
    ).first()

    current_time = datetime.utcnow()

    if view_session:
        # Update existing
        view_session.last_heartbeat = current_time
        view_session.duration_seconds = data.duration_ms / 1000.0
        session.add(view_session)
    else:
        # Create new
        view_session = ViewSession(
            session_id=data.session_id,
            participant_id=data.participant_id,
            video_id=data.video_id,
            start_time=current_time,
            last_heartbeat=current_time,
            duration_seconds=data.duration_ms / 1000.0,
        )
        session.add(view_session)

    session.commit()
    return {"status": "ok"}


# Results endpoints (US5)


@router.get("/api/experiments/{experiment_id}/results")
def get_results_summary(
    experiment_id: UUID,
    session: Session = Depends(get_session),
    current_researcher=Depends(get_current_researcher),
) -> ResultsSummary:
    """Get results summary for an experiment (FR-015)."""
    # Verify experiment exists and belongs to researcher's project
    verify_experiment_ownership(session, experiment_id, current_researcher.id)

    # Get all participants for this experiment
    participants = session.exec(
        select(Participant).where(Participant.experiment_id == experiment_id)
    ).all()

    # Build session summaries
    sessions = []

    # Batch-load all interactions for these participants to avoid N+1 queries
    participant_ids = [p.id for p in participants]
    interactions_by_participant: Dict[UUID, List[Interaction]] = {}
    if participant_ids:
        all_interactions = session.exec(
            select(Interaction)
            .where(Interaction.participant_uuid.in_(participant_ids))
            .order_by(Interaction.participant_uuid, Interaction.timestamp)
        ).all()

        for interaction in all_interactions:
            interactions_by_participant.setdefault(interaction.participant_uuid, []).append(
                interaction
            )

    for participant in participants:
        # Get first and last interaction timestamps from pre-fetched interactions
        interactions = interactions_by_participant.get(participant.id, [])
        started_at = None
        ended_at = None
        total_duration_ms = None

        if interactions:
            started_at = interactions[0].timestamp.isoformat()
            ended_at = interactions[-1].timestamp.isoformat()

            # Calculate total duration from first to last interaction
            if len(interactions) > 1:
                duration = interactions[-1].timestamp - interactions[0].timestamp
                total_duration_ms = int(duration.total_seconds() * 1000)
            else:
                total_duration_ms = 0
        else:
            # Use participant created_at if no interactions
            started_at = participant.created_at.isoformat()

        sessions.append(
            ParticipantSessionSummary(
                participant_id=participant.participant_id,
                started_at=started_at,
                ended_at=ended_at,
                total_duration_ms=total_duration_ms,
            )
        )

    return ResultsSummary(experiment_id=str(experiment_id), sessions=sessions)


@router.post("/api/experiments/{experiment_id}/results/export")
def export_results(
    experiment_id: UUID,
    export_request: ExportRequest,
    session: Session = Depends(get_session),
    current_researcher=Depends(get_current_researcher),
):
    """Export results as CSV or JSON (FR-015)."""
    # Verify experiment exists and belongs to researcher
    verify_experiment_ownership(session, experiment_id, current_researcher.id)

    # Get participants (optionally filtered)
    participants_query = select(Participant).where(Participant.experiment_id == experiment_id)

    if export_request.participant_ids:
        participants_query = participants_query.where(
            Participant.participant_id.in_(export_request.participant_ids)
        )

    participants = session.exec(participants_query).all()

    if export_request.format == "csv":
        return _export_csv(session, participants)
    elif export_request.format == "json":
        return _export_json(session, participants, export_request.include_interactions)
    else:
        # This branch is technically unreachable due to Literal type validation,
        # but kept for explicit error handling and code clarity
        raise HTTPException(status_code=400, detail="Invalid format. Must be 'csv' or 'json'")


def _export_csv(session: Session, participants: List[Participant]) -> StreamingResponse:
    """Generate CSV export with one row per participant session."""
    output = io.StringIO()
    # Use QUOTE_NONNUMERIC to properly escape participant IDs and timestamps
    writer = csv.writer(output, quoting=csv.QUOTE_NONNUMERIC)

    # CSV headers (per-participant aggregate)
    headers = [
        "participantId",
        "startedAt",
        "endedAt",
        "totalDurationMs",
        "totalInteractions",
        "viewCount",
        "likeCount",
        "shareCount",
        "followCount",
        "scrollCount",
    ]
    writer.writerow(headers)

    # Write data for each participant
    # Preload all interactions for the provided participants to avoid N+1 queries.
    participant_ids = [p.id for p in participants]
    interactions_by_participant: Dict[UUID, List[Interaction]] = {}

    if participant_ids:
        all_interactions = session.exec(
            select(Interaction)
            .where(Interaction.participant_uuid.in_(participant_ids))
            .order_by(Interaction.participant_uuid, Interaction.timestamp)
        ).all()

        for interaction in all_interactions:
            interactions_by_participant.setdefault(interaction.participant_uuid, []).append(
                interaction
            )

    for participant in participants:
        # Get all interactions for this participant from the preloaded mapping
        interactions = interactions_by_participant.get(participant.id, [])
        started_at = ""
        ended_at = ""
        total_duration_ms = 0
        total_interactions = len(interactions)

        # Count interaction types with consistent exact matching
        view_count = sum(
            1
            for i in interactions
            if i.interaction_type in ("view", "view_start", "view_end", "view_complete")
        )
        like_count = sum(1 for i in interactions if i.interaction_type in ("like", "unlike"))
        share_count = sum(
            1 for i in interactions if i.interaction_type in ("share", "reshare", "repost")
        )
        follow_count = sum(1 for i in interactions if i.interaction_type in ("follow", "unfollow"))
        scroll_count = sum(
            1 for i in interactions if i.interaction_type in ("scroll_up", "scroll_down", "scroll")
        )

        if interactions:
            started_at = interactions[0].timestamp.isoformat()
            ended_at = interactions[-1].timestamp.isoformat()

            # Calculate total duration
            if len(interactions) > 1:
                duration = interactions[-1].timestamp - interactions[0].timestamp
                total_duration_ms = int(duration.total_seconds() * 1000)
        else:
            # Use participant created_at if no interactions
            started_at = participant.created_at.isoformat()

        row = [
            participant.participant_id,
            started_at,
            ended_at,
            total_duration_ms,
            total_interactions,
            view_count,
            like_count,
            share_count,
            follow_count,
            scroll_count,
        ]
        writer.writerow(row)

    # Prepare response
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=results.csv"},
    )


def _export_json(
    session: Session, participants: List[Participant], include_interactions: bool
) -> Dict[str, Any]:
    """Generate JSON export with full per-participant, per-interaction details."""
    sessions = []

    # Preload all interactions for the provided participants to avoid N+1 queries
    participant_ids = [p.id for p in participants]
    interactions_by_participant: Dict[UUID, List[Interaction]] = {}

    if include_interactions and participant_ids:
        all_interactions = session.exec(
            select(Interaction)
            .where(Interaction.participant_uuid.in_(participant_ids))
            .order_by(Interaction.participant_uuid, Interaction.timestamp)
        ).all()

        for interaction in all_interactions:
            interactions_by_participant.setdefault(interaction.participant_uuid, []).append(
                interaction
            )

    for participant in participants:
        session_data = {
            "participantId": participant.participant_id,
            "startedAt": participant.created_at.isoformat(),
            "interactions": [],
        }

        if include_interactions:
            # Get all interactions for this participant from the preloaded mapping
            interactions = interactions_by_participant.get(participant.id, [])

            for interaction in interactions:
                interaction_data = {
                    "interactionType": interaction.interaction_type,
                    "videoId": str(interaction.video_id),
                    "timestamp": interaction.timestamp.isoformat(),
                    "data": interaction.interaction_data or {},
                }
                session_data["interactions"].append(interaction_data)

        sessions.append(session_data)

    return {"sessions": sessions}
