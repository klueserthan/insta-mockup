"""Tests for US5 results dashboard and export endpoints."""

import csv
import io
import uuid
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from models import (
    Experiment,
    Interaction,
    Participant,
    Project,
    Researcher,
    SocialAccount,
    Video,
)


def _setup_authenticated_researcher(client: TestClient, session: Session, email_suffix: str):
    """Register a researcher and return auth headers and researcher object."""
    from sqlmodel import select

    from tests.helpers import auth_headers, register_and_login

    email = f"results_{email_suffix}@example.com"
    client.post(
        "/api/register",
        json={"email": email, "password": "password123", "name": "Test", "lastname": "User"},
    )
    token = register_and_login(client, email=email)
    headers = auth_headers(token)
    researcher = session.exec(select(Researcher).where(Researcher.email == email)).first()
    return headers, researcher


def _create_researcher(session: Session, email_suffix: str = None) -> Researcher:
    """Create a test researcher."""
    from auth import get_password_hash

    email = f"results_{email_suffix or uuid.uuid4().hex}@example.com"
    hashed_password = get_password_hash("password123")
    researcher = Researcher(name="Results", lastname="Test", email=email, password=hashed_password)
    session.add(researcher)
    session.commit()
    session.refresh(researcher)
    return researcher


def _create_project(session: Session, researcher_id) -> Project:
    """Create a test project."""
    project = Project(name=f"Results Project {uuid.uuid4().hex[:8]}", researcher_id=researcher_id)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def _create_experiment(session: Session, project_id) -> Experiment:
    """Create a test experiment."""
    unique_url = f"results_{uuid.uuid4().hex}"
    experiment = Experiment(
        name=f"Results Exp {uuid.uuid4().hex[:8]}",
        public_url=unique_url,
        project_id=project_id,
        is_active=True,
    )
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    return experiment


def _create_social_account(session: Session, researcher_id) -> SocialAccount:
    """Create a test social account."""
    account = SocialAccount(
        username=f"user_{uuid.uuid4().hex[:8]}",
        display_name="Test User",
        avatar_url="/media/avatar.png",
        researcher_id=researcher_id,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _create_video(session: Session, experiment_id, social_account_id) -> Video:
    """Create a test video."""
    video = Video(
        experiment_id=experiment_id,
        filename="test.mp4",
        social_account_id=social_account_id,
        caption="Test caption",
        likes=100,
        comments=50,
        shares=25,
        song="Test song",
        position=0,
    )
    session.add(video)
    session.commit()
    session.refresh(video)
    return video


def test_get_results_summary_empty(client: TestClient, session: Session):
    """Test getting results for an experiment with no participants."""
    headers, researcher = _setup_authenticated_researcher(client, session, "empty")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)

    # Request results
    response = client.get(f"/api/experiments/{experiment.id}/results", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["experimentId"] == str(experiment.id)
    assert data["sessions"] == []


def test_get_results_summary_with_participants(client: TestClient, session: Session):
    """Test getting results summary with participant sessions."""
    headers, researcher = _setup_authenticated_researcher(client, session, "summary")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create participants with interactions
    participant1 = Participant(
        experiment_id=experiment.id, participant_id="p1", created_at=datetime.utcnow()
    )
    session.add(participant1)
    session.commit()

    participant2 = Participant(
        experiment_id=experiment.id,
        participant_id="p2",
        created_at=datetime.utcnow() - timedelta(hours=1),
    )
    session.add(participant2)
    session.commit()

    # Add interactions for p1
    interaction1 = Interaction(
        participant_uuid=participant1.id,
        video_id=video.id,
        interaction_type="view_start",
        interaction_data={"duration": 5},
        timestamp=datetime.utcnow(),
    )
    session.add(interaction1)
    session.commit()

    # Add interactions for p2
    interaction2 = Interaction(
        participant_uuid=participant2.id,
        video_id=video.id,
        interaction_type="view_start",
        interaction_data={"duration": 10},
        timestamp=datetime.utcnow() - timedelta(minutes=30),
    )
    session.add(interaction2)
    session.commit()

    # Request results
    response = client.get(f"/api/experiments/{experiment.id}/results", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["experimentId"] == str(experiment.id)
    assert len(data["sessions"]) == 2

    # Check session data
    sessions = {s["participantId"]: s for s in data["sessions"]}
    assert "p1" in sessions
    assert "p2" in sessions
    assert sessions["p1"]["startedAt"] is not None


def test_export_csv_format(client: TestClient, session: Session):
    """Test CSV export with proper headers and formatting."""
    headers, researcher = _setup_authenticated_researcher(client, session, "csv")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create participant with interactions
    participant = Participant(
        experiment_id=experiment.id, participant_id="p1", created_at=datetime.utcnow()
    )
    session.add(participant)
    session.commit()

    # Add multiple interactions with actual frontend types
    interactions = [
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="view_start",
            interaction_data={"duration": 5},
            timestamp=datetime.utcnow(),
        ),
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="like",
            interaction_data={},
            timestamp=datetime.utcnow() + timedelta(seconds=3),
        ),
    ]
    for interaction in interactions:
        session.add(interaction)
    session.commit()

    # Request CSV export
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "csv"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"

    # Parse CSV
    csv_content = response.text
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)

    # Check CSV structure
    assert len(rows) >= 1
    first_row = rows[0]
    assert "participantId" in first_row
    assert "startedAt" in first_row
    assert first_row["participantId"] == "p1"


def test_export_csv_selected_participants(client: TestClient, session: Session):
    """Test CSV export with participant ID filtering."""
    headers, researcher = _setup_authenticated_researcher(client, session, "csv_filter")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create multiple participants
    for pid in ["p1", "p2", "p3"]:
        participant = Participant(
            experiment_id=experiment.id, participant_id=pid, created_at=datetime.utcnow()
        )
        session.add(participant)
        session.commit()

        interaction = Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="view_start",
            interaction_data={"duration": 5},
        )
        session.add(interaction)
    session.commit()

    # Export only p1 and p3
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "csv", "participantIds": ["p1", "p3"]},
    )
    assert response.status_code == 200

    # Parse CSV
    csv_content = response.text
    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)

    # Should only have p1 and p3
    participant_ids = {row["participantId"] for row in rows}
    assert participant_ids == {"p1", "p3"}


def test_export_json_format(client: TestClient, session: Session):
    """Test JSON export with full interaction details."""
    headers, researcher = _setup_authenticated_researcher(client, session, "json")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create participant with interactions
    participant = Participant(
        experiment_id=experiment.id, participant_id="p1", created_at=datetime.utcnow()
    )
    session.add(participant)
    session.commit()

    # Add interactions with different types
    interactions = [
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="view_start",
            interaction_data={"duration": 5},
            timestamp=datetime.utcnow(),
        ),
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="like",
            interaction_data={},
            timestamp=datetime.utcnow() + timedelta(seconds=3),
        ),
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="next",
            interaction_data={"direction": "next"},
            timestamp=datetime.utcnow() + timedelta(seconds=5),
        ),
    ]
    for interaction in interactions:
        session.add(interaction)
    session.commit()

    # Request JSON export
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "json"},
    )
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]

    # Parse JSON
    data = response.json()
    assert "sessions" in data
    assert len(data["sessions"]) >= 1

    # Check structure
    session_data = data["sessions"][0]
    assert session_data["participantId"] == "p1"
    assert "interactions" in session_data
    assert len(session_data["interactions"]) == 3

    # Check interaction details
    interaction_types = [i["interactionType"] for i in session_data["interactions"]]
    assert "view_start" in interaction_types
    assert "like" in interaction_types
    assert "next" in interaction_types


def test_export_json_selected_participants(client: TestClient, session: Session):
    """Test JSON export with participant filtering."""
    headers, researcher = _setup_authenticated_researcher(client, session, "json_filter")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create multiple participants
    for pid in ["p1", "p2"]:
        participant = Participant(
            experiment_id=experiment.id, participant_id=pid, created_at=datetime.utcnow()
        )
        session.add(participant)
        session.commit()

        interaction = Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="view_start",
            interaction_data={"duration": 5},
        )
        session.add(interaction)
    session.commit()

    # Export only p2
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "json", "participantIds": ["p2"]},
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["sessions"]) == 1
    assert data["sessions"][0]["participantId"] == "p2"


def test_export_requires_format(client: TestClient, session: Session):
    """Test that export endpoint requires format parameter."""
    headers, researcher = _setup_authenticated_researcher(client, session, "format_req")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)

    # Request without format
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export", headers=headers, json={}
    )
    assert response.status_code == 422  # Validation error


def test_export_invalid_experiment(client: TestClient, session: Session):
    """Test export with non-existent experiment."""
    from tests.helpers import auth_headers, register_and_login

    # Just need any valid auth
    email = f"results_invalid_{uuid.uuid4().hex}@example.com"
    client.post(
        "/api/register",
        json={"email": email, "password": "password123", "name": "Test", "lastname": "User"},
    )
    token = register_and_login(client, email=email)
    headers = auth_headers(token)

    fake_id = str(uuid.uuid4())
    response = client.post(
        f"/api/experiments/{fake_id}/results/export",
        headers=headers,
        json={"format": "csv"},
    )
    assert response.status_code == 404


def test_results_require_auth(client: TestClient, session: Session):
    """Test that results endpoints require authentication."""
    researcher = _create_researcher(session, "auth_test")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)

    # Try without auth
    response = client.get(f"/api/experiments/{experiment.id}/results")
    assert response.status_code == 401

    response = client.post(
        f"/api/experiments/{experiment.id}/results/export", json={"format": "csv"}
    )
    assert response.status_code == 401


def test_results_ownership_verification(client: TestClient, session: Session):
    """Test that researchers can only access results for their own experiments."""
    # Create two researchers
    researcher1 = _create_researcher(session, "owner")
    researcher2 = _create_researcher(session, "other")

    # Create project and experiment for researcher1
    project = _create_project(session, researcher1.id)
    experiment = _create_experiment(session, project.id)

    # Login as researcher2 (who doesn't own the experiment)
    from tests.helpers import auth_headers, register_and_login

    # Register researcher2 first
    client.post(
        "/api/register",
        json={
            "email": researcher2.email,
            "password": "password123",
            "name": researcher2.name,
            "lastname": researcher2.lastname,
        },
    )

    token = register_and_login(client, email=researcher2.email)
    headers = auth_headers(token)

    # Try to access results for researcher1's experiment
    response = client.get(f"/api/experiments/{experiment.id}/results", headers=headers)
    assert response.status_code == 403

    # Try to export results for researcher1's experiment
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "csv"},
    )
    assert response.status_code == 403


def test_export_json_without_interactions(client: TestClient, session: Session):
    """Test JSON export with includeInteractions=False excludes interaction details."""
    headers, researcher = _setup_authenticated_researcher(client, session, "json_no_interactions")
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_social_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Create participant with interactions
    participant = Participant(
        experiment_id=experiment.id, participant_id="p1", created_at=datetime.utcnow()
    )
    session.add(participant)
    session.commit()

    # Add interactions
    interactions = [
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="view_start",
            interaction_data={},
            timestamp=datetime.utcnow(),
        ),
        Interaction(
            participant_uuid=participant.id,
            video_id=video.id,
            interaction_type="like",
            interaction_data={},
            timestamp=datetime.utcnow() + timedelta(seconds=2),
        ),
    ]
    for interaction in interactions:
        session.add(interaction)
    session.commit()

    # Request JSON export without interactions
    response = client.post(
        f"/api/experiments/{experiment.id}/results/export",
        headers=headers,
        json={"format": "json", "includeInteractions": False},
    )
    assert response.status_code == 200

    # Parse JSON
    data = response.json()
    assert "sessions" in data
    assert len(data["sessions"]) == 1

    # Check that interactions array is empty
    session_data = data["sessions"][0]
    assert "participantId" in session_data
    assert session_data["participantId"] == "p1"
    assert "interactions" in session_data
    assert session_data["interactions"] == []
