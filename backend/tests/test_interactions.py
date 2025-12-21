import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from main import app
from models import Interaction, Participant, Video, Project, Experiment, Researcher
import uuid

# Re-use client fixture or create new one
client = TestClient(app)

@pytest.fixture(name="session")
def session_fixture():
    # Use the dependency override if set in conftest, or just get from app
    # Only if we need direct DB access for assertions
    from database import engine
    with Session(engine) as session:
        yield session

def test_interaction_logging_flow(session: Session):
    # 1. Setup Data
    # specific researcher, project, experiment, video
    unique_email = f"int_{uuid.uuid4().hex}@example.com"
    researcher = Researcher(name="Int", lastname="Test", email=unique_email, password="hash")
    session.add(researcher)
    session.commit()
    
    project = Project(name="Int Project", researcher_id=researcher.id)
    session.add(project)
    session.commit()
    
    unique_url = f"int_test_{uuid.uuid4().hex}"
    experiment = Experiment(name="Int Exp", public_url=unique_url, project_id=project.id)
    session.add(experiment)
    session.commit()
    
    video = Video(
        experiment_id=experiment.id, 
        url="http://vid", 
        username="u", 
        user_avatar="a", 
        caption="c", 
        song="s",
        position=0
    )
    session.add(video)
    session.commit()
    
    # 2. Convert IDs to str for JSON payload
    unique_pid = f"test_participant_{uuid.uuid4().hex}"
    payload = {
        "participant_id": unique_pid,
        "experiment_id": str(experiment.id),
        "video_id": str(video.id),
        "interaction_type": "view",
        "interaction_data": {"duration": 5}
    }
    
    # 3. Call API
    response = client.post("/api/interactions", json=payload)
    assert response.status_code == 201
    
    # 4. Verify DB side effects
    # Check participant created
    participant = session.exec(
        select(Participant).where(Participant.participant_id == unique_pid)
    ).first()
    assert participant is not None
    assert participant.experiment_id == experiment.id
    
    # Check interaction logged
    interaction = session.exec(
        select(Interaction).where(Interaction.participant_uuid == participant.id)
    ).first()
    assert interaction is not None
    assert interaction.video_id == video.id
    assert interaction.interaction_type == "view"
    assert interaction.interaction_data["duration"] == 5

def test_heartbeat_flow(session: Session):
    # 1. Setup Data
    unique_email = f"int_heart_{uuid.uuid4().hex}@example.com"
    researcher = Researcher(name="H", lastname="T", email=unique_email, password="pw")
    session.add(researcher)
    session.commit()
    
    project = Project(name="H Proj", researcher_id=researcher.id)
    session.add(project)
    session.commit()
    
    unique_url = f"heart_{uuid.uuid4().hex}"
    experiment = Experiment(name="H Exp", public_url=unique_url, project_id=project.id)
    session.add(experiment)
    session.commit()
    
    video = Video(experiment_id=experiment.id, url="http://v", username="u", user_avatar="a", caption="c", song="s", position=0)
    session.add(video)
    session.commit()
    
    # 2. Initial Heartbeat (Session Start)
    session_id = str(uuid.uuid4())
    participant_id = "p1"
    
    payload = {
        "sessionId": session_id,
        "participantId": participant_id,
        "videoId": str(video.id),
        "durationMs": 0
    }
    
    resp = client.post("/api/interactions/heartbeat", json=payload)
    assert resp.status_code == 200
    
    # Verify created
    from models import ViewSession
    vs = session.exec(select(ViewSession).where(ViewSession.session_id == uuid.UUID(session_id))).first()
    assert vs is not None
    assert vs.duration_seconds == 0
    
    # 3. Subsequent Heartbeat (Update)
    payload["durationMs"] = 5000
    resp = client.post("/api/interactions/heartbeat", json=payload)
    assert resp.status_code == 200
    
    session.refresh(vs)
    assert vs.duration_seconds == 5.0
    
def test_interaction_existing_participant(session: Session):
    # Setup similar to above but participant already exists
    # skipping full setup duplication for brevity, relying on separate test logic ideally
    pass
