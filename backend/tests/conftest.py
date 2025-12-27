import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

os.environ.setdefault("ROCKET_API_KEY", "dummy")

from auth import ensure_dev_user  # noqa: E402
from database import get_session  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        ensure_dev_user(session)
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client: TestClient):
    """Fixture that provides authentication headers for protected endpoints."""
    from tests.helpers import auth_headers, register_and_login

    token = register_and_login(client, email="test_auth_user@example.com")
    return auth_headers(token)
