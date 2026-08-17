from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.schemas.paystack import (
    CardFundInitializeOut,
    CardFundInitializeRequest,
    DVAccountOut,
    DVAStatusOut,
)
from app.schemas.response import SuccessResponse
from app.schemas.savings import SavingsAccountDetail
from app.schemas.wallet import MockFundRequest
from app.services.dva_service import dva_service
from app.services.funding_service import funding_service
from app.services.wallet_service import wallet_service

router = APIRouter(tags=["Wallet"])


@router.get("")
def get_wallet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = wallet_service.get_account(db, user_id=user.id)
    data = SavingsAccountDetail.model_validate(account)
    data.goals = []
    return SuccessResponse(message="Wallet retrieved.", data=data)


@router.post("/fund/mock", response_model=SuccessResponse[SavingsAccountDetail])
def mock_fund_wallet(
    payload: MockFundRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """DEVELOPMENT-ONLY mock wallet funding.

    Never enabled in production — the real provider (Paystack) sits in front of
    wallet_service.credit.
    """
    if settings.environment.lower() == "production":
        raise AppException(
            message="Mock funding is disabled in production.",
            status_code=403,
            error_code="MOCK_FUNDING_DISABLED",
        )

    transaction = wallet_service.credit(
        db,
        user_id=user.id,
        amount=payload.amount,
        description=payload.note or "Mock wallet top-up",
        details={"method": "mock"},
    )

    audit_log_repository.create(
        db,
        actor_id=user.id,
        actor_name=f"{user.first_name} {user.last_name}",
        actor_email=user.email,
        actor_role=user.role,
        action=AuditAction.CREATE,
        category=AuditCategory.TRANSACTION,
        description=f"Mock wallet funding of {payload.amount}.",
        details={"transaction_id": str(transaction.id), "channel": "mock"},
    )

    account = wallet_service.get_account(db, user_id=user.id)
    data = SavingsAccountDetail.model_validate(account)
    data.goals = []
    return SuccessResponse(message="Wallet funded.", data=data)


# ---------------------------------------------------------------------- DVA


@router.get("/dva", response_model=SuccessResponse[DVAStatusOut])
def get_dva(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = dva_service.get_mine(db, user=user)
    return SuccessResponse(
        message="Virtual account retrieved.",
        data=DVAStatusOut(
            dva=DVAccountOut.model_validate(account) if account else None,
            message="You do not have a virtual account yet. Create one to fund your wallet via bank transfer."
            if not account
            else None,
        ),
    )


@router.post("/dva/create", response_model=SuccessResponse[DVAStatusOut])
def create_dva(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = dva_service.get_or_create(db, user=user)
    return SuccessResponse(
        message="Virtual account created.",
        data=DVAStatusOut(dva=DVAccountOut.model_validate(account)),
    )


@router.post("/dva/requery", response_model=SuccessResponse[DVAStatusOut])
def requery_dva(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = dva_service.requery(db, user=user)
    return SuccessResponse(
        message="Virtual account refreshed.",
        data=DVAStatusOut(dva=DVAccountOut.model_validate(account)),
    )


# ------------------------------------------------------------- card funding


@router.post("/fund/card/initialize", response_model=SuccessResponse[CardFundInitializeOut])
def initialize_card_funding(
    payload: CardFundInitializeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = funding_service.initialize_card(db, user=user, amount=payload.amount, callback_url=payload.callback_url)
    return SuccessResponse(message="Payment initialized.", data=CardFundInitializeOut(**result))


@router.get("/fund/card/verify/{reference}", response_model=SuccessResponse[CardFundInitializeOut])
def verify_card_funding(reference: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment, credited = funding_service.verify_card(db, user=user, reference=reference)
    return SuccessResponse(
        message="Wallet funded." if credited else "Payment has not been confirmed yet.",
        data=CardFundInitializeOut(
            authorization_url="",
            reference=reference,
            access_code=None,
        ),
    )
