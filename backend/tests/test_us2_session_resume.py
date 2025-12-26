"""Tests for User Story 2: Participant timed feed, session resume, and end screen.

These tests verify:
- T019: Feed delivery includes all required settings (persistTimer, projectSettings)
- T020: Timer enforcement (frontend implementation verified via manual test)
- T021: End screen rendering (frontend implementation verified via manual test)
- T022: Session resume logic (frontend implementation verified via manual test)
- T023: Participant identity extraction from Project.queryKey
- T024: Interaction and heartbeat logging
"""

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from models import Experiment, Interaction, Participant, Project, Researcher, SocialAccount, Video, ViewSession

# Test fixture: base timestamp for consistent test data
TEST_BASE_TIMESTAMP = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


def _create_researcher(session: Session) -> Researcher:
    """Helper to create a unique researcher."""
    unique_email = f"us2_{uuid.uuid4().hex}@test.com"
    researcher = Researcher(name="US2", lastname="Test", email=unique_email, password="hash")
    session.add(researcher)
    session.commit()
    session.refresh(researcher)
    return researcher


def _create_project(session: Session, researcher_id, **kwargs) -> Project:
    """Helper to create a project with custom settings."""
    defaults = {
        "name": "US2 Test Project",
        "query_key": "participantId",
        "time_limit_seconds": 300,
        "redirect_url": "https://survey.example.com",
        "end_screen_message": "Thank you for participating!",
    }
    defaults.update(kwargs)
    project = Project(researcher_id=researcher_id, **defaults)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def _create_experiment(session: Session, project_id, **kwargs) -> Experiment:
    """Helper to create an active experiment."""
    unique_url = f"us2_{uuid.uuid4().hex}"
    defaults = {
        "name": "US2 Test Experiment",
        "public_url": unique_url,
        "is_active": True,
        "persist_timer": True,
        "show_unmute_prompt": True,
    }
    defaults.update(kwargs)
    experiment = Experiment(project_id=project_id, **defaults)
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    return experiment


def _create_account(session: Session, *, researcher_id) -> SocialAccount:
    """Helper to create a social account."""
    acc = SocialAccount(
        username=f"u_{uuid.uuid4().hex}",
        display_name="Test User",
        avatar_url="/media/avatar.png",
        researcher_id=researcher_id,
    )
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return acc


def _create_video(session: Session, experiment_id, social_account_id, position=0) -> Video:
    """Helper to create a video."""
    video = Video(
        experiment_id=experiment_id,
        filename=f"video_{position}.mp4",
        social_account_id=social_account_id,
        caption=f"Video {position}",
        likes=100,
        comments=10,
        shares=5,
        song="Test Song",
        position=position,
    )
    session.add(video)
    session.commit()
    session.refresh(video)
    return video


def test_t019_feed_payload_includes_all_settings(client: TestClient, session: Session):
    """T019: Feed endpoint returns experiment settings and ordered videos."""
    # Setup
    researcher = _create_researcher(session)
    project = _create_project(
        session,
        researcher.id,
        query_key="userId",
        time_limit_seconds=600,
        redirect_url="https://example.com/survey",
        end_screen_message="Thanks!",
    )
    experiment = _create_experiment(session, project.id, persist_timer=True, show_unmute_prompt=False)
    account = _create_account(session, researcher.id)
    video1 = _create_video(session, experiment.id, account.id, position=0)
    video2 = _create_video(session, experiment.id, account.id, position=1)

    # Act
    response = client.get(f"/api/feed/{experiment.public_url}")
    assert response.status_code == 200

    data = response.json()

    # Assert experiment-level settings
    assert data["experimentId"] == str(experiment.id)
    assert data["experimentName"] == experiment.name
    assert data["persistTimer"] is True
    assert data["showUnmutePrompt"] is False

    # Assert project settings
    assert "projectSettings" in data
    project_settings = data["projectSettings"]
    assert project_settings["queryKey"] == "userId"
    assert project_settings["timeLimitSeconds"] == 600
    assert project_settings["redirectUrl"] == "https://example.com/survey"
    assert project_settings["endScreenMessage"] == "Thanks!"

    # Assert videos are included and ordered
    assert len(data["videos"]) == 2
    assert data["videos"][0]["id"] == str(video1.id)
    assert data["videos"][0]["caption"] == "Video 0"
    assert data["videos"][1]["id"] == str(video2.id)
    assert data["videos"][1]["caption"] == "Video 1"

    # Assert social account is included
    assert data["videos"][0]["socialAccount"] is not None
    assert data["videos"][0]["socialAccount"]["username"] == account.username


def test_t023_participant_identity_from_custom_query_key(client: TestClient, session: Session):
    """T023: Feed uses project's queryKey to identify participants."""
    # Setup
    researcher = _create_researcher(session)
    project = _create_project(session, researcher.id, query_key="customId")
    experiment = _create_experiment(session, project.id)
    account = _create_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    # Act - access feed with custom query parameter
    participant_id = "test_participant_xyz"
    response = client.get(f"/api/feed/{experiment.public_url}?customId={participant_id}")
    assert response.status_code == 200

    data = response.json()
    assert data["projectSettings"]["queryKey"] == "customId"

    # Verify interaction logging works with custom queryKey
    # (This simulates what frontend does: extracts participantId using the returned queryKey)
    interaction_response = client.post(
        "/api/interactions",
        json={
            "participantId": participant_id,
            "experimentId": str(experiment.id),
            "videoId": str(video.id),
            "interactionType": "view_start",
            "interactionData": {"timestamp": "2024-01-01T00:00:00Z"},
        },
    )
    assert interaction_response.status_code == 201

    # Verify participant was created with correct ID
    participant = session.exec(
        select(Participant).where(
            Participant.participant_id == participant_id,
            Participant.experiment_id == experiment.id,
        )
    ).first()
    assert participant is not None


def test_t024_interaction_logging(client: TestClient, session: Session):
    """T024: Verify interaction logging works for various event types."""
    # Setup
    researcher = _create_researcher(session)
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    participant_id = f"p_{uuid.uuid4().hex}"

    # Access feed first (establishes session)
    feed_resp = client.get(f"/api/feed/{experiment.public_url}?participantId={participant_id}")
    assert feed_resp.status_code == 200

    # Test various interaction types as per FR-011
    # Timestamps use TEST_BASE_TIMESTAMP to clearly indicate test data
    from datetime import timedelta
    
    interaction_types = [
        ("view_start", {"timestamp": TEST_BASE_TIMESTAMP.isoformat()}),  # User lands on video
        ("next", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=5)).isoformat()}),  # User scrolls to next video
        ("view_end", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=5)).isoformat()}),  # Previous video ends
        ("previous", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=10)).isoformat()}),  # User scrolls back
        ("like", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=15)).isoformat()}),  # User likes current video
        ("unlike", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=20)).isoformat()}),  # User unlikes
        ("follow", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=25)).isoformat()}),  # User follows account
        ("unfollow", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=30)).isoformat()}),  # User unfollows
        ("share", {"timestamp": (TEST_BASE_TIMESTAMP + timedelta(seconds=35)).isoformat()}),  # User opens share menu
    ]

    for interaction_type, data in interaction_types:
        response = client.post(
            "/api/interactions",
            json={
                "participantId": participant_id,
                "experimentId": str(experiment.id),
                "videoId": str(video.id),
                "interactionType": interaction_type,
                "interactionData": data,
            },
        )
        assert response.status_code == 201, f"Failed to log {interaction_type}"

    # Verify all interactions were logged
    participant = session.exec(
        select(Participant).where(
            Participant.participant_id == participant_id,
            Participant.experiment_id == experiment.id,
        )
    ).first()
    assert participant is not None

    interactions = session.exec(
        select(Interaction).where(Interaction.participant_uuid == participant.id)
    ).all()
    assert len(interactions) == len(interaction_types)

    # Verify interaction types are correct
    logged_types = [i.interaction_type for i in interactions]
    expected_types = [t[0] for t in interaction_types]
    assert set(logged_types) == set(expected_types)


def test_t024_heartbeat_logging(client: TestClient, session: Session):
    """T024: Verify heartbeat logging tracks session duration."""
    # Setup
    researcher = _create_researcher(session)
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id)
    account = _create_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    participant_id = f"p_{uuid.uuid4().hex}"
    session_id = str(uuid.uuid4())

    # Access feed first
    feed_resp = client.get(f"/api/feed/{experiment.public_url}?participantId={participant_id}")
    assert feed_resp.status_code == 200

    # Send initial heartbeat (0ms)
    response = client.post(
        "/api/interactions/heartbeat",
        json={
            "sessionId": session_id,
            "participantId": participant_id,
            "videoId": str(video.id),
            "durationMs": 0,
        },
    )
    assert response.status_code == 200

    # Verify ViewSession was created
    view_session = session.exec(
        select(ViewSession).where(ViewSession.session_id == uuid.UUID(session_id))
    ).first()
    assert view_session is not None
    assert view_session.participant_id == participant_id
    assert view_session.video_id == video.id
    assert view_session.duration_seconds == 0.0

    # Send updated heartbeat (5000ms = 5 seconds)
    response = client.post(
        "/api/interactions/heartbeat",
        json={
            "sessionId": session_id,
            "participantId": participant_id,
            "videoId": str(video.id),
            "durationMs": 5000,
        },
    )
    assert response.status_code == 200

    # Verify duration was updated
    session.refresh(view_session)
    assert view_session.duration_seconds == 5.0

    # Send another update (10000ms = 10 seconds)
    response = client.post(
        "/api/interactions/heartbeat",
        json={
            "sessionId": session_id,
            "participantId": participant_id,
            "videoId": str(video.id),
            "durationMs": 10000,
        },
    )
    assert response.status_code == 200

    session.refresh(view_session)
    assert view_session.duration_seconds == 10.0


def test_inactive_experiment_returns_403(client: TestClient, session: Session):
    """Verify that inactive experiments return 403 (kill switch)."""
    researcher = _create_researcher(session)
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id, is_active=False)

    response = client.get(f"/api/feed/{experiment.public_url}")
    assert response.status_code == 403
    data = response.json()
    assert "active" in data["detail"].lower()


def test_session_resume_same_participant_id(client: TestClient, session: Session):
    """
    Verify that the same participant can access the feed multiple times.
    
    Frontend uses localStorage to track timer state keyed by experimentId + participantId.
    This test verifies backend allows repeated access with same participantId.
    """
    researcher = _create_researcher(session)
    project = _create_project(session, researcher.id)
    experiment = _create_experiment(session, project.id, persist_timer=True)
    account = _create_account(session, researcher.id)
    video = _create_video(session, experiment.id, account.id)

    participant_id = "consistent_participant"

    # First access
    response1 = client.get(f"/api/feed/{experiment.public_url}?participantId={participant_id}")
    assert response1.status_code == 200

    # Log an interaction
    client.post(
        "/api/interactions",
        json={
            "participantId": participant_id,
            "experimentId": str(experiment.id),
            "videoId": str(video.id),
            "interactionType": "view_start",
        },
    )

    # Second access (simulating refresh/reopen)
    response2 = client.get(f"/api/feed/{experiment.public_url}?participantId={participant_id}")
    assert response2.status_code == 200

    # Both responses should have persistTimer=True to enable session resume
    assert response1.json()["persistTimer"] is True
    assert response2.json()["persistTimer"] is True

    # Verify only one participant record exists
    participants = session.exec(
        select(Participant).where(
            Participant.participant_id == participant_id,
            Participant.experiment_id == experiment.id,
        )
    ).all()
    assert len(participants) == 1
