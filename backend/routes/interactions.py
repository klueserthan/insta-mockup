from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session
from typing import Dict, Any, Optional
from uuid import UUID

from database import get_session
from models import Interaction, CamelModel, Participant, Video, Experiment
# We assume implicit participant tracking for now, or use the participantId passed in body.

class InteractionCreate(CamelModel):
    participant_id: str
    experiment_id: UUID
    video_id: UUID
    interaction_type: str
    interaction_data: Optional[Dict[str, Any]] = None  # Renamed from metadata to avoid shadow

router = APIRouter()

@router.post("/api/interactions", status_code=201)
def log_interaction(
    interaction: InteractionCreate,
    session: Session = Depends(get_session)
):
    # 1. Ensure participant exists or find their ID
    # In the current model, Participant is linked to experiment.
    # We first try to find the participant by their ID string and experiment ID
    
    from sqlmodel import select
    db_participant = session.exec(
        select(Participant).where(
            Participant.participant_id == interaction.participant_id,
            Participant.experiment_id == interaction.experiment_id
        )
    ).first()
    
    if not db_participant:
        # Auto-enroll/create participant if not exists?
        # Typically yes for this kind of public feed logging.
        db_participant = Participant(
            participant_id=interaction.participant_id,
            experiment_id=interaction.experiment_id
        )
        session.add(db_participant)
        session.commit()
        session.refresh(db_participant)
        
    # 2. Log Interaction
    db_interaction = Interaction(
        participant_uuid=db_participant.id,
        video_id=interaction.video_id,
        interaction_type=interaction.interaction_type,
        interaction_data=interaction.interaction_data
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
def heartbeat(
    data: Heartbeat,
    session: Session = Depends(get_session)
):
    from models import ViewSession
    from datetime import datetime
    
    # Try to find existing session
    from sqlmodel import select
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
            duration_seconds=data.duration_ms / 1000.0
        )
        session.add(view_session)
        
    session.commit()
    return {"status": "ok"}
