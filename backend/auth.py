import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from pydantic import BaseModel
from sqlmodel import Session, select

from config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from database import get_session
from models import CamelModel, RefreshToken, Researcher, ResearcherBase

# Password hashing using pwdlib with Argon2 (per plan.md)
pwd_hasher = PasswordHash.recommended()

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


def create_refresh_token(researcher_id: UUID, session: Session) -> str:
    """Create a refresh token that lasts 7 days"""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    refresh_token = RefreshToken(
        researcher_id=researcher_id, token=token, expires_at=expires_at
    )
    session.add(refresh_token)
    session.commit()
    return token


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


class ResearcherRegister(ResearcherBase):
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Token(CamelModel):
    access_token: str
    token_type: str
    expires_in: Optional[int] = None
    refresh_token: Optional[str] = None


@router.post("/register", status_code=201, response_model=Token)
def register(registration_data: ResearcherRegister, session: Session = Depends(get_session)):
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

    # Create JWT token for the new user (auto-login after registration)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_researcher.email}, expires_delta=access_token_expires
    )

    # Create refresh token
    refresh_token = create_refresh_token(db_researcher.id, session)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, session: Session = Depends(get_session)):
    """Login researcher and return JWT token"""
    user = session.exec(select(Researcher).where(Researcher.email == login_data.email)).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)

    # Create refresh token
    refresh_token = create_refresh_token(user.id, session)

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        refresh_token=refresh_token,
    )


@router.post("/logout")
def logout():
    """Logout endpoint (JWT tokens are stateless, client should discard token)"""
    return {"message": "Logged out"}


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
def refresh_access_token(
    refresh_request: RefreshTokenRequest, session: Session = Depends(get_session)
):
    """Exchange refresh token for new access token"""
    db_token = session.exec(
        select(RefreshToken).where(
            RefreshToken.token == refresh_request.refresh_token,
            RefreshToken.is_revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    ).first()

    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    researcher = session.get(Researcher, db_token.researcher_id)
    if not researcher:
        raise HTTPException(status_code=401, detail="Researcher not found")

    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": researcher.email}, expires_delta=access_token_expires
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/revoke")
def revoke_refresh_token(
    refresh_request: RefreshTokenRequest, session: Session = Depends(get_session)
):
    """Revoke a refresh token (logout)"""
    db_token = session.exec(
        select(RefreshToken).where(RefreshToken.token == refresh_request.refresh_token)
    ).first()

    if db_token:
        db_token.is_revoked = True
        db_token.revoked_at = datetime.now(timezone.utc)
        session.add(db_token)
        session.commit()

    return {"message": "Token revoked"}


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
