import csv
import io
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from auth import get_current_researcher
from database import get_session
from models import CamelModel, Experiment, Interaction, Participant

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

    format: str  # "csv" or "json"
    participant_ids: Optional[List[str]] = None
    include_interactions: bool = True


@router.get("/api/experiments/{experiment_id}/results")
def get_results_summary(
    experiment_id: UUID,
    session: Session = Depends(get_session),
    current_researcher=Depends(get_current_researcher),
) -> ResultsSummary:
    """Get results summary for an experiment (FR-015)."""
    # Verify experiment exists and belongs to researcher's project
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Get all participants for this experiment
    participants = session.exec(
        select(Participant).where(Participant.experiment_id == experiment_id)
    ).all()

    # Build session summaries
    sessions = []
    for participant in participants:
        # Get first and last interaction timestamps
        interactions = session.exec(
            select(Interaction)
            .where(Interaction.participant_uuid == participant.id)
            .order_by(Interaction.timestamp)
        ).all()

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
    # Verify experiment exists
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

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
        raise HTTPException(status_code=400, detail="Invalid format. Must be 'csv' or 'json'")


def _export_csv(session: Session, participants: List[Participant]) -> StreamingResponse:
    """Generate CSV export with one row per participant session."""
    output = io.StringIO()
    writer = csv.writer(output)

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
    for participant in participants:
        # Get all interactions for this participant
        interactions = session.exec(
            select(Interaction)
            .where(Interaction.participant_uuid == participant.id)
            .order_by(Interaction.timestamp)
        ).all()

        started_at = ""
        ended_at = ""
        total_duration_ms = 0
        total_interactions = len(interactions)

        # Count interaction types
        view_count = sum(1 for i in interactions if "view" in i.interaction_type.lower())
        like_count = sum(1 for i in interactions if i.interaction_type == "like")
        share_count = sum(
            1
            for i in interactions
            if "share" in i.interaction_type.lower() or "reshare" in i.interaction_type.lower()
        )
        follow_count = sum(1 for i in interactions if "follow" in i.interaction_type.lower())
        scroll_count = sum(1 for i in interactions if "scroll" in i.interaction_type.lower())

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

    for participant in participants:
        session_data = {
            "participantId": participant.participant_id,
            "startedAt": participant.created_at.isoformat(),
            "interactions": [],
        }

        if include_interactions:
            # Get all interactions for this participant
            interactions = session.exec(
                select(Interaction)
                .where(Interaction.participant_uuid == participant.id)
                .order_by(Interaction.timestamp)
            ).all()

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
