from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from uuid import UUID

from database import get_session
from models import Project, ProjectBase, Researcher, CamelModel
from auth import get_current_user

router = APIRouter(prefix="/api/projects")

@router.get("", response_model=List[Project])
def get_projects(
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    projects = session.exec(select(Project).where(Project.researcher_id == current_user.id)).all()
    return projects

@router.get("/{project_id}", response_model=Project)
def get_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Optional: Enforce ownership check
    # if project.researcher_id != current_user.id:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    return project

@router.post("", response_model=Project, status_code=201)
def create_project(
    project_base: ProjectBase,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    project = Project(**project_base.dict(), researcher_id=current_user.id)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

class ProjectUpdate(CamelModel):
    name: Optional[str] = None
    query_key: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    redirect_url: Optional[str] = None
    end_screen_message: Optional[str] = None
    lock_all_positions: Optional[bool] = None
    randomization_seed: Optional[int] = None

@router.patch("/{project_id}", response_model=Project)
def update_project(
    project_id: UUID,
    project_update: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    db_project = session.get(Project, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if db_project.researcher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    project_data = project_update.dict(exclude_unset=True)
    for key, value in project_data.items():
        setattr(db_project, key, value)
    
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_user)
):
    db_project = session.get(Project, project_id)
    if not db_project:
        # Idempotent or 404
        return
    
    if db_project.researcher_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    session.delete(db_project)
    session.commit()
