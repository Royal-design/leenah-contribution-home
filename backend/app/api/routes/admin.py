import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_admin
from app.core.database import get_db
from app.models.enums import TransactionStatus, TransactionType, UserRole, UserStatus, WithdrawalStatus
from app.models.user import User
from app.schemas.admin import AdminStats
from app.schemas.contribution import ContributionCreate, ContributionOut
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.transaction import TransactionOut
from app.schemas.user import (
    BulkInviteRequest,
    InviteUserRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
    UserOut,
)
from app.schemas.withdrawal import WithdrawalOut, WithdrawalReview
from app.services.analytics_service import analytics_service
from app.services.contribution_service import contribution_service
from app.services.transaction_service import transaction_service
from app.services.user_service import user_service
from app.services.withdrawal_service import withdrawal_service

router = APIRouter(tags=["Admin"])


# ---- Stats ----

@router.get("/stats", response_model=SuccessResponse[AdminStats])
def admin_stats(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return SuccessResponse(message="Admin stats retrieved.", data=analytics_service.stats(db))


@router.get("/overview")
def admin_overview(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return SuccessResponse(
        message="Admin overview retrieved.",
        data={
            "stats": analytics_service.stats(db),
            "recent_transactions": analytics_service.recent_transactions(db, limit=10),
        },
    )


# ---- Users ----

@router.get("/users")
def list_admin_users(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=120),
    role: UserRole | None = Query(default=None),
    status: UserStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = user_service.list_users(db, search=search, role=role, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Users retrieved.", data=data)


@router.get("/users/{user_id}")
def get_admin_user(user_id: uuid.UUID, _: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    data = analytics_service.user_detail(db, user_id)
    data["user"] = UserOut.model_validate(data["user"])
    return SuccessResponse(message="User retrieved.", data=data)


@router.post("/users/invite", response_model=SuccessResponse[UserOut])
def invite_user(payload: InviteUserRequest, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = user_service.invite_user(
        db,
        actor=admin,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        role=payload.role,
    )
    return SuccessResponse(message="Invitation sent.", data=UserOut.model_validate(user))


@router.post("/users/bulk")
def bulk_invite(payload: BulkInviteRequest, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    created = user_service.bulk_invite(db, actor=admin, users=payload.users)
    return SuccessResponse(message="Bulk invitations sent.", data=[UserOut.model_validate(u) for u in created])


@router.get("/roles")
def list_roles(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    roles = user_service.role_summary(db)
    return SuccessResponse(message="Roles retrieved.", data=roles)


@router.patch("/users/{user_id}/role", response_model=SuccessResponse[UserOut])
def set_user_role(
    user_id: uuid.UUID,
    payload: UpdateUserRoleRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = user_service.set_role(db, actor=admin, user_id=user_id, role=payload.role)
    return SuccessResponse(message="User role updated.", data=UserOut.model_validate(user))


@router.patch("/users/{user_id}/status", response_model=SuccessResponse[UserOut])
def set_user_status(
    user_id: uuid.UUID,
    payload: UpdateUserStatusRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = user_service.set_status(db, actor=admin, user_id=user_id, status=payload.status)
    return SuccessResponse(message="User status updated.", data=UserOut.model_validate(user))


@router.delete("/users/{user_id}", response_model=MessageResponse)
def delete_user(user_id: uuid.UUID, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user_service.delete_user(db, actor=admin, user_id=user_id)
    return MessageResponse(message="User deleted.")


# ---- Contributions ----

@router.post("/contributions", response_model=SuccessResponse[ContributionOut])
def admin_create_contribution(
    payload: ContributionCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.create(db, user=admin, payload=payload)
    return SuccessResponse(message="Contribution created.", data=result)


@router.get("/contributions")
def list_all_contributions(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = contribution_service.list_all(db, search=search, page=page, page_size=page_size)
    return SuccessResponse(message="Contributions retrieved.", data=data)


# ---- Transactions ----

@router.get("/transactions")
def list_all_transactions(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    type: TransactionType | None = Query(default=None, alias="type"),
    status: TransactionStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = transaction_service.list_all(db, type_=type, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Transactions retrieved.", data=data)


@router.post("/transactions/{transaction_id}/revert", response_model=SuccessResponse[TransactionOut])
def revert_transaction(transaction_id: uuid.UUID, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    transaction = transaction_service.revert(db, actor=admin, transaction_id=transaction_id)
    return SuccessResponse(message="Transaction reverted.", data=TransactionOut.model_validate(transaction))


# ---- Withdrawals ----

@router.get("/withdrawals")
def list_all_withdrawals(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    status: WithdrawalStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = withdrawal_service.list_all(db, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Withdrawals retrieved.", data=data)


@router.patch("/withdrawals/{withdrawal_id}/review", response_model=SuccessResponse[WithdrawalOut])
def review_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalReview,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    withdrawal = withdrawal_service.review(db, actor=admin, withdrawal_id=withdrawal_id, status=payload.status)
    return SuccessResponse(message="Withdrawal reviewed.", data=WithdrawalOut.model_validate(withdrawal))