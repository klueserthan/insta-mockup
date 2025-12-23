import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from pwdlib import PasswordHash
from sqlmodel import Session, select

from database import get_session
from models import Researcher, ResearcherBase

# Password hashing using pwdlib with Argon2 (per plan.md)
pwd_hasher = PasswordHash.recommended()

# JWT configuration
SECRET_KEY = os.environ.get("SESSION_SECRET", "supersecretkey")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ALGORITHM = "HS256"

# Bearer token scheme
bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash using Argon2"""
    return pwd_hasher.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using Argon2"""
    return pwd_hasher.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with expiration"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


router = APIRouter(prefix="/api")


# JWT Bearer token dependency (replaces session-cookie auth)
async def get_current_researcher(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> Researcher:
    """
    Validate JWT Bearer token and return the current researcher.
    Raises 401 if token is missing, invalid, or expired.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.exec(select(Researcher).where(Researcher.email == email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Legacy session-cookie dependency (kept for backward compatibility during migration)
def get_current_user(request: Request, session: Session = Depends(get_session)):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user = session.get(Researcher, UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


class ResearcherRegister(ResearcherBase):
    password: str


@router.post(
    "/register", status_code=201, response_model=Researcher, response_model_exclude={"password"}
)
def register(
    registration_data: ResearcherRegister, request: Request, session: Session = Depends(get_session)
):
    # Check if user exists
    existing_user = session.exec(
        select(Researcher).where(Researcher.email == registration_data.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    hashed_password = get_password_hash(registration_data.password)
    db_researcher = Researcher.from_orm(registration_data)
    db_researcher.password = hashed_password
    session.add(db_researcher)
    session.commit()
    session.refresh(db_researcher)

    # Log them in (set session)
    request.session["user_id"] = str(db_researcher.id)

    return db_researcher


class LoginRequest(BaseModel):
    email: str
    password: str


from models import CamelModel


class Token(CamelModel):
    access_token: str
    token_type: str
    expires_in: Optional[int] = None


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, session: Session = Depends(get_session)):
    """Login researcher and return JWT token"""
    user = session.exec(select(Researcher).where(Researcher.email == login_data.email)).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Also set session for backward compatibility
    request.session["user_id"] = str(user.id)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}


@router.get("/user", response_model=Researcher, response_model_exclude={"password"})
def get_user(current_user: Researcher = Depends(get_current_researcher)):
    """Get current researcher (JWT-based)"""
    return current_user


def ensure_dev_user(session: Session):
    dev_email = "test@research.edu"
    user = session.exec(select(Researcher).where(Researcher.email == dev_email)).first()
    if not user:
        # Create dev user
        dev_user = Researcher(
            email=dev_email, password=get_password_hash("password123"), name="Dev", lastname="User"
        )
        session.add(dev_user)
        session.commit()
