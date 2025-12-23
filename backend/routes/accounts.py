from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from auth import get_current_researcher
from database import get_session
from models import Researcher, SocialAccount, SocialAccountBase

router = APIRouter()


@router.get("/api/accounts", response_model=List[SocialAccount])
def get_accounts(
    session: Session = Depends(get_session), current_user: Researcher = Depends(get_current_researcher)
):
    accounts = session.exec(
        select(SocialAccount).where(SocialAccount.researcher_id == current_user.id)
    ).all()
    return accounts


@router.post("/api/accounts", response_model=SocialAccount, status_code=201)
def create_account(
    account_base: SocialAccountBase,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    # Check uniqueness of username? DB constraint will handle it, but maybe better to check manually to avoid 500
    existing = session.exec(
        select(SocialAccount).where(SocialAccount.username == account_base.username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    account = SocialAccount(**account_base.dict(), researcher_id=current_user.id)

    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@router.delete("/api/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: UUID,
    session: Session = Depends(get_session),
    current_user: Researcher = Depends(get_current_researcher),
):
    account = session.get(SocialAccount, account_id)
    if not account:
        return

    if account.researcher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(account)
    session.commit()
