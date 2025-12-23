from secrets import token_hex
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import get_current_researcher
from database import get_session
from models import CamelModel, Experiment, Project, Researcher

router = APIRouter()


# Helper functions for ownership verification
def verify_project_ownership(session: Session, project_id: UUID, user_id: UUID) -> Project:
    """Verify that the user owns the project. Returns project if authorized."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return project


def verify_experiment_ownership(session: Session, experiment_id: UUID, user_id: UUID) -> Experiment:
    """Verify that the user owns the experiment (via its project). Returns experiment if authorized."""
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project or project.researcher_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return experiment


@router.get("/api/projects/{project_id}/experiments", response_model=List[Experiment])
def get_experiments(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    verify_project_ownership(session, project_id, current_user.id)
    experiments = session.exec(select(Experiment).where(Experiment.project_id == project_id)).all()
    return experiments


# Redefining models for Request Body locally to avoid Import Cycles or just for clarity
class ExperimentCreate(CamelModel):
    name: str
    persist_timer: bool = False
    show_unmute_prompt: bool = True
    is_active: bool = False


@router.post("/api/projects/{project_id}/experiments", response_model=Experiment, status_code=201)
def create_experiment_implementation(  # Renamed to avoid using the decorative one above if I overwrite
    project_id: UUID,
    experiment_create: ExperimentCreate,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    verify_project_ownership(session, project_id, current_user.id)

    public_url = token_hex(16)
    experiment = Experiment(
        **experiment_create.dict(), project_id=project_id, public_url=public_url
    )
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    return experiment


class ExperimentUpdate(CamelModel):
    name: Optional[str] = None
    public_url: Optional[str] = None
    persist_timer: Optional[bool] = None
    show_unmute_prompt: Optional[bool] = None
    is_active: Optional[bool] = None


@router.patch("/api/experiments/{experiment_id}", response_model=Experiment)
def update_experiment(
    experiment_id: UUID,
    experiment_update: ExperimentUpdate,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    # Verify ownership and get experiment in one step
    db_experiment = verify_experiment_ownership(session, experiment_id, current_user.id)

    experiment_data = experiment_update.dict(exclude_unset=True)
    for key, value in experiment_data.items():
        setattr(db_experiment, key, value)

    session.add(db_experiment)
    session.commit()
    session.refresh(db_experiment)
    return db_experiment


@router.delete("/api/experiments/{experiment_id}", status_code=204)
def delete_experiment(
    experiment_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    # Verify ownership and get experiment in one step
    # If experiment doesn't exist or user doesn't own it, will raise appropriate error
    db_experiment = verify_experiment_ownership(session, experiment_id, current_user.id)

    session.delete(db_experiment)
    session.commit()
