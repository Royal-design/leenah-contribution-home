import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_admin, get_current_user
from app.core.database import get_db
from app.models.enums import ContributionStatus, FundingMethod
from app.models.user import User
from app.schemas.contribution import (
    ContributionCreate,
    ContributionOut,
    ContributionUpdate,
    PayContributionRequest,
)
from app.schemas.response import MessageResponse, SuccessResponse
from app.services.contribution_service import contribution_service

router = APIRouter(tags=["Contributions"])


@router.post("", response_model=SuccessResponse[ContributionOut])
def create_contribution(
    payload: ContributionCreate,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    # Only admins create contribution plans. Users can only join.
    result = contribution_service.create(db, user=user, payload=payload)
    return SuccessResponse(message="Contribution created.", data=result)


@router.get("")
def list_my_contributions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: ContributionStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = contribution_service.list_mine(db, user=user, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Contributions retrieved.", data=data)


@router.get("/open")
def list_open_contributions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = contribution_service.list_open(db, page=page, page_size=page_size)
    return SuccessResponse(message="Open contributions retrieved.", data=data)


@router.post("/{contribution_id}/join", response_model=SuccessResponse[ContributionOut])
def join_contribution(contribution_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = contribution_service.join(db, user=user, contribution_id=contribution_id)
    return SuccessResponse(message="Joined contribution.", data=result)


@router.post("/{contribution_id}/leave", response_model=MessageResponse)
def leave_contribution(contribution_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contribution_service.leave(db, user=user, contribution_id=contribution_id)
    return MessageResponse(message="Left contribution.")


@router.post("/schedules/{schedule_id}/pay", response_model=SuccessResponse[ContributionOut])
def pay_schedule(
    schedule_id: int,
    contribution_id: uuid.UUID = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = contribution_service.pay(
        db,
        user=user,
        contribution_id=contribution_id,
        schedule_id=schedule_id,
        funding_method=FundingMethod.WALLET,
    )
    return SuccessResponse(message="Payment recorded.", data=result)


@router.post("/{contribution_id}/pay", response_model=SuccessResponse[ContributionOut])
def pay_contribution(
    contribution_id: uuid.UUID,
    payload: PayContributionRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    funding_method = payload.funding_method if payload else FundingMethod.WALLET
    schedule_id = payload.schedule_id if payload else None
    result = contribution_service.pay(
        db,
        user=user,
        contribution_id=contribution_id,
        schedule_id=schedule_id,
        funding_method=funding_method,
    )
    return SuccessResponse(message="Payment recorded.", data=result)


@router.get("/{contribution_id}", response_model=SuccessResponse[ContributionOut])
def get_contribution(contribution_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = contribution_service.get(db, user=user, contribution_id=contribution_id)
    return SuccessResponse(message="Contribution retrieved.", data=result)


@router.patch("/{contribution_id}", response_model=SuccessResponse[ContributionOut])
def update_contribution(
    contribution_id: uuid.UUID,
    payload: ContributionUpdate,
    user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.update(db, user=user, contribution_id=contribution_id, payload=payload)
    return SuccessResponse(message="Contribution updated.", data=result)


@router.delete("/{contribution_id}", response_model=MessageResponse)
def delete_contribution(contribution_id: uuid.UUID, user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    contribution_service.delete(db, user=user, contribution_id=contribution_id)
    return MessageResponse(message="Contribution deleted.")