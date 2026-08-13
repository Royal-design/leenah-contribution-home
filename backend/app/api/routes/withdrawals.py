import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.enums import WithdrawalStatus
from app.models.user import User
from app.schemas.response import SuccessResponse
from app.schemas.withdrawal import WithdrawalCreate, WithdrawalOut
from app.services.withdrawal_service import withdrawal_service

router = APIRouter(tags=["Withdrawals"])


@router.post("", response_model=SuccessResponse[WithdrawalOut])
def request_withdrawal(payload: WithdrawalCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    withdrawal = withdrawal_service.request(
        db,
        user=user,
        amount=payload.amount,
        withdrawal_type=payload.withdrawal_type,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        account_name=payload.account_name,
        destination=payload.destination,
        contribution_id=payload.contribution_id,
    )
    return SuccessResponse(message="Withdrawal requested.", data=WithdrawalOut.model_validate(withdrawal))


@router.get("")
def list_my_withdrawals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: WithdrawalStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = withdrawal_service.list_mine(db, user=user, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Withdrawals retrieved.", data=data)


@router.get("/{withdrawal_id}", response_model=SuccessResponse[WithdrawalOut])
def get_withdrawal(withdrawal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = withdrawal_service.get(db, user=user, withdrawal_id=withdrawal_id)
    return SuccessResponse(message="Withdrawal retrieved.", data=result)