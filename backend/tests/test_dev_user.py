from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from auth import ensure_dev_user, verify_password
from models import Researcher


def test_ensure_dev_user_creation():
    # 1. Ensure user is created
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        ensure_dev_user(session)

        user = session.exec(
            select(Researcher).where(Researcher.email == "test@research.edu")
        ).first()
        assert user is not None, "Dev user was not created"
        assert user.email == "test@research.edu"

        # 2. Verify password
        # We manually check the password hash matches "password123"
        assert verify_password("password123", user.password), "Password mismatch for dev user"


def test_login_dev_user(client: TestClient):
    # This integration test mimics the actual login flow
    response = client.post(
        "/api/login", json={"email": "test@research.edu", "password": "password123"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert data["email"] == "test@research.edu"
