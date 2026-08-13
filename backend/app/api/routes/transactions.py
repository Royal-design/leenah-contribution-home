import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.enums import TransactionStatus, TransactionType
from app.models.user import User
from app.schemas.response import SuccessResponse
from app.schemas.transaction import TransactionOut
from app.services.transaction_service import transaction_service

router = APIRouter(tags=["Transactions"])


@router.get("")
def list_transactions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    type: TransactionType | None = Query(default=None, alias="type"),
    status: TransactionStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = transaction_service.list_mine(db, user=user, type_=type, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Transactions retrieved.", data=data)


@router.get("/{transaction_id}", response_model=SuccessResponse[TransactionOut])
def get_transaction(transaction_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    transaction = transaction_service.get(db, user=user, transaction_id=transaction_id)
    return SuccessResponse(message="Transaction retrieved.", data=TransactionOut.model_validate(transaction))