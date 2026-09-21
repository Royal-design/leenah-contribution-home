import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.enums import FundingMethod, SavingsPlanStatus
from app.models.user import User
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.savings_plan import PaySavingsPlanRequest, SavingsPlanOut
from app.services.savings_plan_service import savings_plan_service

router = APIRouter(tags=["Savings Plans"])


@router.get("/mine")
def list_my_savings_plans(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: SavingsPlanStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = savings_plan_service.list_mine(db, user=user, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Savings plans retrieved.", data=data)


@router.get("/open")
def list_open_savings_plans(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = savings_plan_service.list_open(db, page=page, page_size=page_size)
    return SuccessResponse(message="Open savings plans retrieved.", data=data)


@router.post("/{plan_id}/join", response_model=SuccessResponse[SavingsPlanOut])
def join_savings_plan(plan_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = savings_plan_service.join(db, user=user, plan_id=plan_id)
    return SuccessResponse(message="Joined savings plan.", data=result)


@router.post("/{plan_id}/leave", response_model=MessageResponse)
def leave_savings_plan(plan_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    savings_plan_service.leave(db, user=user, plan_id=plan_id)
    return MessageResponse(message="Left savings plan.")


@router.post("/{plan_id}/pay", response_model=SuccessResponse[SavingsPlanOut])
def pay_savings_plan(
    plan_id: uuid.UUID,
    payload: PaySavingsPlanRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    funding_method = payload.funding_method if payload else FundingMethod.WALLET
    if funding_method != FundingMethod.WALLET:
        from app.core.exceptions import AppException

        raise AppException(
            message="Card and bank transfer funding are not available yet. Use your wallet.",
            status_code=400,
            error_code="FUNDING_METHOD_UNAVAILABLE",
        )
    schedule_id = payload.schedule_id if payload else None
    result = savings_plan_service.pay(db, user=user, plan_id=plan_id, schedule_id=schedule_id)
    return SuccessResponse(message="Savings payment recorded.", data=result)


@router.get("/{plan_id}", response_model=SuccessResponse[SavingsPlanOut])
def get_savings_plan(plan_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = savings_plan_service.get(db, user=user, plan_id=plan_id)
    return SuccessResponse(message="Savings plan retrieved.", data=result)