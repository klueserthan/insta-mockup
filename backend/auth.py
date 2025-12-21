from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlmodel import Session, select
from uuid import UUID

from database import get_session
from models import Researcher, ResearcherBase

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

router = APIRouter(prefix="/api")

# Dependency to get current user based on session cookie
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

@router.post("/register", status_code=201, response_model=Researcher, response_model_exclude={"password"})
def register(
    registration_data: ResearcherRegister, 
    request: Request,
    session: Session = Depends(get_session)
):
    # Check if user exists
    existing_user = session.exec(select(Researcher).where(Researcher.email == registration_data.email)).first()
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

@router.post("/login")
def login(
    login_data: LoginRequest,
    request: Request,
    session: Session = Depends(get_session)
):
    user = session.exec(select(Researcher).where(Researcher.email == login_data.email)).first()
    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    
    request.session["user_id"] = str(user.id)
    return user

@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}

@router.get("/user", response_model=Researcher, response_model_exclude={"password"})
def get_user(current_user: Researcher = Depends(get_current_user)):
    return current_user

def ensure_dev_user(session: Session):
    dev_email = "test@research.edu"
    user = session.exec(select(Researcher).where(Researcher.email == dev_email)).first()
    if not user:
        # Create dev user
        dev_user = Researcher(
            email=dev_email,
            password=get_password_hash("password123"),
            name="Dev",
            lastname="User"
        )
        session.add(dev_user)
        session.commit()

