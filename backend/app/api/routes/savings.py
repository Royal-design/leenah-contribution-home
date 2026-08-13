import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.savings import (
    FundSavingsRequest,
    SavingsAccountDetail,
    SavingsGoalCreate,
    SavingsGoalOut,
    SavingsGoalUpdate,
)
from app.services.savings_service import savings_service

router = APIRouter(tags=["Savings"])


@router.get("/account", response_model=SuccessResponse[SavingsAccountDetail])
def get_savings_account(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = savings_service.get_account(db, user=user)
    return SuccessResponse(message="Savings account retrieved.", data=data)


@router.post("/fund", response_model=SuccessResponse[SavingsAccountDetail])
def fund_savings(
    payload: FundSavingsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    data = savings_service.fund(
        db,
        user=user,
        amount=payload.amount,
        note=payload.note,
        ip_address=ip,
        goal_id=payload.goal_id,
    )
    return SuccessResponse(message="Savings funded.", data=data)


@router.get("/goals")
def list_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goals = savings_service.list_goals(db, user=user)
    return SuccessResponse(message="Savings goals retrieved.", data=[SavingsGoalOut.model_validate(g) for g in goals])


@router.post("/goals", response_model=SuccessResponse[SavingsGoalOut])
def create_goal(payload: SavingsGoalCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = savings_service.create_goal(
        db,
        user=user,
        name=payload.name,
        target=payload.target,
        color=payload.color,
        target_date=payload.target_date,
    )
    return SuccessResponse(message="Savings goal created.", data=SavingsGoalOut.model_validate(goal))


@router.get("/goals/{goal_id}", response_model=SuccessResponse[SavingsGoalOut])
def get_goal(goal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = savings_service.get_goal(db, user=user, goal_id=goal_id)
    return SuccessResponse(message="Savings goal retrieved.", data=SavingsGoalOut.model_validate(goal))


@router.patch("/goals/{goal_id}", response_model=SuccessResponse[SavingsGoalOut])
def update_goal(payload: SavingsGoalUpdate, goal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = savings_service.update_goal(db, user=user, goal_id=goal_id, **payload.model_dump(exclude_unset=True))
    return SuccessResponse(message="Savings goal updated.", data=SavingsGoalOut.model_validate(goal))


@router.delete("/goals/{goal_id}", response_model=MessageResponse)
def delete_goal(goal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    savings_service.delete_goal(db, user=user, goal_id=goal_id)
    return MessageResponse(message="Savings goal deleted.")