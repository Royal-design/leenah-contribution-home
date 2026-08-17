import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.bank_account import UserBankAccountCreate, UserBankAccountOut, UserBankAccountUpdate
from app.schemas.paystack import BankAccountResolveOut, BankAccountResolveRequest
from app.schemas.response import MessageResponse, SuccessResponse
from app.services.bank_account_service import bank_account_service

router = APIRouter(tags=["Bank Accounts"])


@router.get("")
def list_bank_accounts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    accounts = bank_account_service.list_mine(db, user=user)
    return SuccessResponse(
        message="Bank accounts retrieved.",
        data=[UserBankAccountOut.model_validate(a) for a in accounts],
    )


@router.get("/banks")
def list_banks(user: User = Depends(get_current_user)):
    data = bank_account_service.list_banks()
    return SuccessResponse(message="Banks retrieved.", data=data)


@router.post("/resolve", response_model=SuccessResponse[BankAccountResolveOut])
def resolve_bank_account(
    payload: BankAccountResolveRequest,
    user: User = Depends(get_current_user),
):
    result = bank_account_service.resolve(account_number=payload.account_number, bank_code=payload.bank_code)
    return SuccessResponse(message="Account verified.", data=BankAccountResolveOut(**result))


@router.post("", response_model=SuccessResponse[UserBankAccountOut])
def create_bank_account(payload: UserBankAccountCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = bank_account_service.create(
        db,
        user=user,
        bank_code=payload.bank_code,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        account_name=payload.account_name,
        is_default=payload.is_default,
    )
    return SuccessResponse(message="Bank account saved and verified.", data=UserBankAccountOut.model_validate(account))


@router.patch("/{account_id}", response_model=SuccessResponse[UserBankAccountOut])
def update_bank_account(account_id: uuid.UUID, payload: UserBankAccountUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = bank_account_service.update(db, user=user, account_id=account_id, **payload.model_dump(exclude_unset=True))
    if payload.is_default:
        bank_account_service.set_default(db, user=user, account_id=account_id)
    return SuccessResponse(message="Bank account updated.", data=UserBankAccountOut.model_validate(account))


@router.post("/{account_id}/set-default", response_model=SuccessResponse[UserBankAccountOut])
def set_default_bank_account(account_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = bank_account_service.set_default(db, user=user, account_id=account_id)
    return SuccessResponse(message="Default bank account updated.", data=UserBankAccountOut.model_validate(account))


@router.delete("/{account_id}", response_model=MessageResponse)
def delete_bank_account(account_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bank_account_service.delete(db, user=user, account_id=account_id)
    return MessageResponse(message="Bank account deleted.")
