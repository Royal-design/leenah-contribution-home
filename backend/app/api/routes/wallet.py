from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.schemas.response import SuccessResponse
from app.schemas.savings import SavingsAccountDetail
from app.schemas.wallet import MockFundRequest
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

    Never enabled in production — a real provider (Paystack) will sit in front of
    wallet_service.credit once integrated.
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