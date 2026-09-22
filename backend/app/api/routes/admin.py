import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_admin
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.enums import (
    AuditAction,
    AuditCategory,
    SavingsPlanStatus,
    TransactionStatus,
    TransactionType,
    UserRole,
    UserStatus,
    WithdrawalStatus,
)
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.user_repository import user_repository
from app.schemas.admin import AdminStats
from app.schemas.contribution import (
    ContributionCreate,
    ContributionMemberAdd,
    ContributionMemberPositionUpdate,
    ContributionOut,
    ContributionUpdate,
)
from app.schemas.notification import BroadcastMessageRequest, DirectMessageRequest
from app.schemas.paystack import WithdrawalApproveRequest, WithdrawalRejectRequest
from app.schemas.commission import CommissionSettingsOut, CommissionSettingsUpdate
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.savings_plan import SavingsPlanCreate, SavingsPlanOut, SavingsPlanUpdate
from app.schemas.transaction import TransactionOut
from app.schemas.user import (
    BulkInviteRequest,
    InviteUserRequest,
    UpdateUserRoleRequest,
    UpdateUserRolesRequest,
    UpdateUserStatusRequest,
    UserOut,
)
from app.schemas.withdrawal import AdminPayoutRequest, WithdrawalOut, WithdrawalReview
from app.services.analytics_service import analytics_service
from app.services.commission_service import commission_service
from app.services.contribution_service import contribution_service
from app.services.notification_service import notification_service
from app.services.savings_plan_service import savings_plan_service
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


@router.patch("/users/{user_id}/roles", response_model=SuccessResponse[UserOut])
def set_user_roles(
    user_id: uuid.UUID,
    payload: UpdateUserRolesRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = user_service.set_roles(db, actor=admin, user_id=user_id, roles=payload.roles)
    return SuccessResponse(message="User roles updated.", data=UserOut.model_validate(user))


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


@router.get("/contributions/{contribution_id}", response_model=SuccessResponse[ContributionOut])
def get_admin_contribution(
    contribution_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.get(db, user=admin, contribution_id=contribution_id)
    return SuccessResponse(message="Contribution retrieved.", data=result)


@router.patch("/contributions/{contribution_id}", response_model=SuccessResponse[ContributionOut])
def admin_update_contribution(
    contribution_id: uuid.UUID,
    payload: ContributionUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.admin_update(db, actor=admin, contribution_id=contribution_id, payload=payload)
    return SuccessResponse(message="Contribution updated.", data=result)


@router.delete("/contributions/{contribution_id}", response_model=MessageResponse)
def admin_delete_contribution(
    contribution_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    contribution_service.admin_delete(db, actor=admin, contribution_id=contribution_id)
    return MessageResponse(message="Contribution deleted.")


@router.post("/contributions/run-automatic")
def run_automatic_contributions(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    result = contribution_service.run_automatic_contributions(db)
    return SuccessResponse(message="Automatic contributions processed.", data=result)


@router.post("/contributions/{contribution_id}/members", response_model=SuccessResponse[ContributionOut])
def admin_add_contribution_member(
    contribution_id: uuid.UUID,
    payload: ContributionMemberAdd,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.admin_add_member(
        db, actor=admin, contribution_id=contribution_id, user_id=payload.user_id
    )
    return SuccessResponse(message="Member added.", data=result)


@router.patch(
    "/contributions/{contribution_id}/members/{user_id}/position",
    response_model=SuccessResponse[ContributionOut],
)
def admin_set_contribution_member_position(
    contribution_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ContributionMemberPositionUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.admin_set_position(
        db, actor=admin, contribution_id=contribution_id, user_id=user_id, position=payload.position
    )
    return SuccessResponse(message="Member position updated.", data=result)


@router.delete("/contributions/{contribution_id}/members/{user_id}", response_model=SuccessResponse[ContributionOut])
def admin_remove_contribution_member(
    contribution_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = contribution_service.admin_remove_member(
        db, actor=admin, contribution_id=contribution_id, user_id=user_id
    )
    return SuccessResponse(message="Member removed.", data=result)


# ---- Savings plans ----

@router.post("/savings-plans", response_model=SuccessResponse[SavingsPlanOut])
def admin_create_savings_plan(
    payload: SavingsPlanCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.create(db, user=admin, payload=payload)
    return SuccessResponse(message="Savings plan created.", data=result)


@router.get("/savings-plans")
def list_all_savings_plans(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=120),
    status: SavingsPlanStatus | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = savings_plan_service.list_all(db, search=search, status=status, page=page, page_size=page_size)
    return SuccessResponse(message="Savings plans retrieved.", data=data)


@router.get("/savings-plans/{plan_id}", response_model=SuccessResponse[SavingsPlanOut])
def get_admin_savings_plan(
    plan_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.get(db, user=None, plan_id=plan_id)
    return SuccessResponse(message="Savings plan retrieved.", data=result)


@router.patch("/savings-plans/{plan_id}", response_model=SuccessResponse[SavingsPlanOut])
def admin_update_savings_plan(
    plan_id: uuid.UUID,
    payload: SavingsPlanUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.update(db, user=admin, plan_id=plan_id, payload=payload)
    return SuccessResponse(message="Savings plan updated.", data=result)


@router.delete("/savings-plans/{plan_id}", response_model=MessageResponse)
def admin_delete_savings_plan(
    plan_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    savings_plan_service.delete(db, user=admin, plan_id=plan_id)
    return MessageResponse(message="Savings plan deleted.")


@router.post("/savings-plans/run-automatic")
def run_automatic_savings_plans(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    result = savings_plan_service.run_automatic(db)
    return SuccessResponse(message="Automatic savings collected.", data=result)


@router.get("/savings-plans/{plan_id}/enrollments")
def admin_list_savings_plan_enrollments(
    plan_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.enrollments(db, plan_id=plan_id)
    return SuccessResponse(message="Savings plan enrollments retrieved.", data=result)


@router.post("/savings-plans/{plan_id}/members", response_model=SuccessResponse[SavingsPlanOut])
def admin_add_savings_plan_member(
    plan_id: uuid.UUID,
    payload: ContributionMemberAdd,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.admin_add_member(
        db, actor=admin, plan_id=plan_id, user_id=payload.user_id
    )
    return SuccessResponse(message="Member added.", data=result)


@router.delete("/savings-plans/{plan_id}/members/{user_id}", response_model=SuccessResponse[SavingsPlanOut])
def admin_remove_savings_plan_member(
    plan_id: uuid.UUID,
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = savings_plan_service.admin_remove_member(
        db, actor=admin, plan_id=plan_id, user_id=user_id
    )
    return SuccessResponse(message="Member removed.", data=result)


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


@router.delete("/transactions/{transaction_id}", response_model=MessageResponse)
def delete_transaction(transaction_id: uuid.UUID, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    transaction_service.delete(db, actor=admin, transaction_id=transaction_id)
    return MessageResponse(message="Transaction deleted.")


# ---- Withdrawals ----

@router.get("/withdrawals")
def list_all_withdrawals(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    status: WithdrawalStatus | None = Query(default=None),
    source: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = withdrawal_service.list_all(db, status=status, source=source, page=page, page_size=page_size)
    return SuccessResponse(message="Withdrawals retrieved.", data=data)


@router.post("/withdrawals", response_model=SuccessResponse[WithdrawalOut])
def admin_initiate_payout(
    payload: AdminPayoutRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin-controlled withdrawal/payout executed on a user's behalf."""
    target = user_repository.get(db, payload.user_id)
    if target is None:
        raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")
    withdrawal = withdrawal_service.admin_payout(
        db,
        actor=admin,
        user=target,
        amount=payload.amount,
        channel=payload.channel.value,
        reason=payload.reason,
        bank_account_id=payload.bank_account_id,
        savings_plan_id=payload.savings_plan_id,
        contribution_id=payload.contribution_id,
        admin_note=payload.admin_note,
    )
    return SuccessResponse(message="Admin payout processed.", data=WithdrawalOut.model_validate(withdrawal))


@router.get("/withdrawals/{withdrawal_id}", response_model=SuccessResponse[WithdrawalOut])
def get_admin_withdrawal(
    withdrawal_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    result = withdrawal_service.get_for_admin(db, withdrawal_id=withdrawal_id)
    return SuccessResponse(message="Withdrawal retrieved.", data=result)


@router.post("/withdrawals/{withdrawal_id}/approve", response_model=SuccessResponse[WithdrawalOut])
def approve_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalApproveRequest | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    reason = payload.reason if payload else None
    withdrawal = withdrawal_service.approve(db, actor=admin, withdrawal_id=withdrawal_id, reason=reason)
    return SuccessResponse(message="Withdrawal approved and transfer initiated.", data=WithdrawalOut.model_validate(withdrawal))


@router.post("/withdrawals/{withdrawal_id}/reject", response_model=SuccessResponse[WithdrawalOut])
def reject_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalRejectRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    withdrawal = withdrawal_service.reject(db, actor=admin, withdrawal_id=withdrawal_id, reason=payload.reason)
    return SuccessResponse(message="Withdrawal rejected.", data=WithdrawalOut.model_validate(withdrawal))


@router.patch("/withdrawals/{withdrawal_id}/review", response_model=SuccessResponse[WithdrawalOut])
def review_withdrawal(
    withdrawal_id: uuid.UUID,
    payload: WithdrawalReview,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    withdrawal = withdrawal_service.review(db, actor=admin, withdrawal_id=withdrawal_id, status=payload.status, reason=payload.reason)
    return SuccessResponse(message="Withdrawal reviewed.", data=WithdrawalOut.model_validate(withdrawal))


@router.post("/withdrawals/{withdrawal_id}/complete", response_model=SuccessResponse[WithdrawalOut])
def complete_withdrawal(
    withdrawal_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    withdrawal = withdrawal_service.complete(db, actor=admin, withdrawal_id=withdrawal_id)
    return SuccessResponse(message="Withdrawal marked as completed.", data=WithdrawalOut.model_validate(withdrawal))


# ---- Contribution payouts ----

@router.get("/payouts")
def list_pending_payouts(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    data = contribution_service.list_pending_payouts(db)
    return SuccessResponse(message="Payouts retrieved.", data=data)


@router.post("/payouts/{payout_id}/approve")
def approve_payout(
    payout_id: uuid.UUID,
    payload: WithdrawalApproveRequest | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    payout = contribution_service.approve_payout(db, actor=admin, payout_id=payout_id, note=(payload.reason if payload else None))
    return SuccessResponse(message="Payout approved and credited to member wallet.", data={"payout_id": str(payout.id), "status": payout.status.value})


@router.post("/payouts/{payout_id}/reject")
def reject_payout(
    payout_id: uuid.UUID,
    payload: WithdrawalRejectRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    payout = contribution_service.reject_payout(db, actor=admin, payout_id=payout_id, note=payload.reason)
    return SuccessResponse(message="Payout rejected.", data={"payout_id": str(payout.id), "status": payout.status.value})


# ---- Commission ledger & settings ----

@router.get("/commissions")
def list_commission_ledger(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = transaction_service.list_commissions(db, page=page, page_size=page_size)
    return SuccessResponse(message="Commission ledger retrieved.", data=data)


@router.get("/commissions/summary")
def commission_summary(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    data = transaction_service.commission_summary(db)
    return SuccessResponse(message="Commission summary retrieved.", data=data)


@router.get("/settings/commissions", response_model=SuccessResponse[CommissionSettingsOut])
def get_commission_settings(_: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    data = commission_service.get_settings_dto(db)
    return SuccessResponse(message="Commission settings retrieved.", data=data)


@router.put("/settings/commissions")
def update_commission_settings(
    payload: CommissionSettingsUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    normalized = commission_service.set_defaults(db, payload.defaults, actor_id=admin.id)
    audit_log_repository.create(
        db,
        actor_id=admin.id,
        actor_name=f"{admin.first_name} {admin.last_name}",
        actor_email=admin.email,
        actor_role=admin.role,
        action=AuditAction.SETTINGS_UPDATE,
        category=AuditCategory.SETTINGS,
        description="Updated platform commission settings.",
        target="commission_settings",
        details={"defaults": normalized},
    )
    return SuccessResponse(message="Commission settings updated.", data=commission_service.get_settings_dto(db))



# ---- Messages ----

@router.post("/messages/broadcast")
def send_broadcast_message(
    payload: BroadcastMessageRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    recipients = notification_service.notify_all_users(
        db, title=payload.title, message=payload.message, type_=payload.type
    )
    audit_log_repository.create(
        db,
        actor_id=admin.id,
        actor_name=f"{admin.first_name} {admin.last_name}",
        actor_email=admin.email,
        actor_role=admin.role,
        action=AuditAction.CREATE,
        category=AuditCategory.SYSTEM,
        description=f"Admin broadcast a message to all users: '{payload.title}'.",
        target=payload.title,
    )
    return SuccessResponse(message="Message sent to all users.", data={"recipients": recipients})


@router.post("/messages/direct")
def send_direct_message(
    payload: DirectMessageRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    target = user_repository.get(db, payload.user_id)
    if target is None:
        raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")
    notification_service.create(
        db,
        user_id=payload.user_id,
        title=payload.title,
        message=payload.message,
        type_=payload.type,
    )
    audit_log_repository.create(
        db,
        actor_id=admin.id,
        actor_name=f"{admin.first_name} {admin.last_name}",
        actor_email=admin.email,
        actor_role=admin.role,
        action=AuditAction.CREATE,
        category=AuditCategory.SYSTEM,
        description=f"Admin sent a message to {target.first_name} {target.last_name}: '{payload.title}'.",
        target=target.email,
        target_id=target.id,
    )
    return SuccessResponse(message="Message sent.", data={"recipient": str(payload.user_id)})