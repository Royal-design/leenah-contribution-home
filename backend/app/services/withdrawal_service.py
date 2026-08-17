from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import (
    AuditAction,
    AuditCategory,
    NotificationType,
    TransactionStatus,
    TransactionType,
    WithdrawalStatus,
)
from app.models.contribution import Contribution
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.contribution_repository import contribution_member_repository, contribution_repository
from app.repositories.savings_repository import savings_account_repository
from app.repositories.transaction_repository import transaction_repository
from app.repositories.withdrawal_repository import withdrawal_repository
from app.schemas.withdrawal import WithdrawalOut
from app.services.bank_account_service import bank_account_service
from app.services.notification_service import notification_service
from app.services.payment_provider import payment_provider
from app.services.wallet_service import wallet_service


def _make_reference() -> str:
    from datetime import datetime as dt

    return f"WDL-{dt.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"


def _mask_account(number: str) -> str:
    return f"****{number[-4:]}"


def _withdrawal_txn_reference(withdrawal_id: uuid.UUID) -> str:
    return f"WDL-{withdrawal_id.hex.upper()[:16]}"


def _resolve_contribution(db: Session, *, user: User, contribution_id: uuid.UUID | None, amount: int) -> tuple[Contribution | None, str | None]:
    if contribution_id is None:
        return None, None

    contribution = contribution_repository.get(db, contribution_id)
    if contribution is None:
        raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

    member = contribution_member_repository.get(db, contribution_id, user.id)
    if member is None:
        raise AppException(
            message="You must join a contribution before withdrawing from it.",
            status_code=403,
            error_code="NOT_MEMBER",
        )

    rule = contribution.withdrawal_rule or {}
    fixed_date = contribution.withdrawal_date
    if rule.get("type") == "fixed_date" and fixed_date is not None:
        now = datetime.now(timezone.utc)
        fixed = fixed_date.replace(tzinfo=timezone.utc) if fixed_date.tzinfo is None else fixed_date
        if now < fixed:
            raise AppException(
                message=f"This contribution is locked until {fixed.strftime('%d %b %Y')}.",
                status_code=400,
                error_code="CONTRIBUTION_LOCKED",
                detail=f"unlock_at={fixed.isoformat()}",
            )

    if amount > contribution.total_expected:
        raise AppException(
            message="Requested amount exceeds the contribution payout.",
            status_code=400,
            error_code="AMOUNT_EXCEEDS_CONTRIBUTION",
        )

    return contribution, contribution.name


class WithdrawalService:
    def _own(self, db: Session, withdrawal_id: uuid.UUID, user_id: uuid.UUID) -> Withdrawal:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None or withdrawal.user_id != user_id:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        return withdrawal

    # ---------------------------------------------------------------- request

    def request(
        self,
        db: Session,
        *,
        user: User,
        amount: int,
        withdrawal_type: str,
        bank_account_id: uuid.UUID | None = None,
        bank_name: str | None = None,
        account_number: str | None = None,
        account_name: str | None = None,
        destination: str | None = None,
        contribution_id: uuid.UUID | None = None,
    ) -> Withdrawal:
        if withdrawal_type not in ("savings", "contribution"):
            raise AppException(message="Invalid withdrawal type.", status_code=400, error_code="INVALID_WITHDRAWAL_TYPE")

        recipient_code = None
        if bank_account_id is not None:
            account = bank_account_service._own(db, user.id, bank_account_id)
            if not account.is_verified or not account.provider_recipient_code:
                raise AppException(
                    message="Only verified bank accounts can receive withdrawals.",
                    status_code=400,
                    error_code="UNVERIFIED_BANK_ACCOUNT",
                )
            bank_name = account.bank_name
            account_number = account.account_number
            account_name = account.account_name
            destination = f"{_mask_account(account.account_number)} {account.bank_name}"
            recipient_code = account.provider_recipient_code
        elif withdrawal_type == "savings":
            raise AppException(
                message="A verified bank account is required for savings withdrawals.",
                status_code=400,
                error_code="VERIFIED_BANK_ACCOUNT_REQUIRED",
            )
        else:
            if not (bank_name and account_number):
                raise AppException(
                    message="Bank details are required for this withdrawal.",
                    status_code=400,
                    error_code="BANK_DETAILS_REQUIRED",
                )
            destination = destination or f"{_mask_account(account_number)} {bank_name}"

        contribution_name = None
        if withdrawal_type == "savings":
            savings = savings_account_repository.get_for_user(db, user.id)
            balance = savings.balance if savings else 0
            if amount > balance:
                raise AppException(
                    message="Insufficient savings balance for this withdrawal.",
                    status_code=400,
                    error_code="INSUFFICIENT_BALANCE",
                )
        elif withdrawal_type == "contribution":
            if contribution_id is None:
                raise AppException(
                    message="contribution_id is required for contribution withdrawals.",
                    status_code=400,
                    error_code="CONTRIBUTION_ID_REQUIRED",
                )
            _, contribution_name = _resolve_contribution(db, user=user, contribution_id=contribution_id, amount=amount)

        withdrawal = withdrawal_repository.create(
            db,
            user_id=user.id,
            amount=amount,
            withdrawal_type=withdrawal_type,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            destination=destination,
            contribution_name=contribution_name,
            bank_account_id=bank_account_id,
            paystack_recipient_code=recipient_code,
        )

        # Reserve funds immediately — they are no longer spendable.
        if withdrawal_type == "savings":
            wallet_service.reserve(
                db,
                user_id=user.id,
                amount=amount,
                description=f"Withdrawal to {destination}",
                reference=_withdrawal_txn_reference(withdrawal.id),
                details={"withdrawal_id": str(withdrawal.id), "bank": bank_name, "method": "wallet"},
            )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Requested {withdrawal_type} withdrawal of {amount}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={"bank_name": bank_name, "account_number": _mask_account(account_number)},
        )

        notification_service.notify_admins(
            db,
            title="New withdrawal request",
            message=f"{user.first_name} {user.last_name} requested a {withdrawal_type} withdrawal of {amount}.",
            type_=NotificationType.WITHDRAWAL,
        )
        return withdrawal

    # ------------------------------------------------------------ listing/get

    def list_mine(self, db: Session, *, user: User, status: WithdrawalStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = withdrawal_repository.list_mine(db, user.id, status=status, page=page, page_size=page_size)
        return {
            "items": [WithdrawalOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def list_all(self, db: Session, *, status: WithdrawalStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = withdrawal_repository.list_all(db, status=status, page=page, page_size=page_size)
        return {
            "items": [WithdrawalOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def get(self, db: Session, *, user: User, withdrawal_id: uuid.UUID) -> WithdrawalOut:
        return WithdrawalOut.model_validate(self._own(db, withdrawal_id, user.id))

    def get_for_admin(self, db: Session, *, withdrawal_id: uuid.UUID) -> WithdrawalOut:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        return WithdrawalOut.model_validate(withdrawal)

    # ---------------------------------------------------------- review action

    def review(self, db: Session, *, actor: User, withdrawal_id: uuid.UUID, status: str, reason: str | None = None) -> Withdrawal:
        if status not in ("approved", "rejected"):
            raise AppException(message="Status must be 'approved' or 'rejected'.", status_code=400, error_code="INVALID_REVIEW_STATUS")

        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        if withdrawal.status != WithdrawalStatus.PENDING:
            raise AppException(message="Withdrawal has already been reviewed.", status_code=400, error_code="ALREADY_REVIEWED")

        if status == "approved":
            return self._approve(db, actor, withdrawal)
        return self._reject(db, actor, withdrawal, reason)

    def approve(self, db: Session, *, actor: User, withdrawal_id: uuid.UUID, reason: str | None = None) -> Withdrawal:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        if withdrawal.status != WithdrawalStatus.PENDING:
            raise AppException(message="Withdrawal has already been reviewed.", status_code=400, error_code="ALREADY_REVIEWED")
        return self._approve(db, actor, withdrawal, reason)

    def reject(self, db: Session, *, actor: User, withdrawal_id: uuid.UUID, reason: str) -> Withdrawal:
        if not reason or not reason.strip():
            raise AppException(
                message="A reason is required to reject a withdrawal.",
                status_code=400,
                error_code="REASON_REQUIRED",
            )
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        if withdrawal.status != WithdrawalStatus.PENDING:
            raise AppException(message="Withdrawal has already been reviewed.", status_code=400, error_code="ALREADY_REVIEWED")
        return self._reject(db, actor, withdrawal, reason)

    def _approve(self, db: Session, actor: User, withdrawal: Withdrawal, reason: str | None = None) -> Withdrawal:
        now = datetime.now(timezone.utc)
        withdrawal.reviewed_by = actor.id
        withdrawal.reviewed_at = now
        withdrawal.admin_id = actor.id
        withdrawal.approved_at = now

        if withdrawal.withdrawal_type == "savings":
            if not withdrawal.paystack_recipient_code:
                raise AppException(
                    message="This withdrawal has no verified payout recipient. Ask the user to re-add their bank account.",
                    status_code=400,
                    error_code="PAYSTACK_RECIPIENT_REQUIRED",
                )
            # Initiate the Paystack transfer (amount is in kobo for Paystack).
            reference = f"TRF-{withdrawal.id.hex.upper()[:16]}"
            transfer = payment_provider.transfer(
                recipient_code=withdrawal.paystack_recipient_code,
                amount=withdrawal.amount * 100,
                reference=reference,
                reason=f"LCH withdrawal {withdrawal.amount}",
            )
            withdrawal.paystack_transfer_code = transfer.get("transfer_code")
            withdrawal.paystack_reference = reference
            # The transfer is NOT complete just because Paystack accepted it.
            withdrawal.status = WithdrawalStatus.PROCESSING
        else:
            # Contribution-type withdrawals keep the legacy approval; money is
            # attributed from the contribution pot on completion.
            withdrawal.status = WithdrawalStatus.APPROVED
            transaction_repository.create(
                db,
                user_id=withdrawal.user_id,
                type_=TransactionType.WITHDRAWAL,
                status=TransactionStatus.SUCCESSFUL,
                amount=withdrawal.amount,
                description=f"{withdrawal.withdrawal_type.title()} withdrawal to {withdrawal.destination}",
                reference=_make_reference(),
                details={"withdrawal_id": str(withdrawal.id), "bank": withdrawal.bank_name},
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.APPROVE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Approved withdrawal of {withdrawal.amount} for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={"reason": reason, "transfer_code": withdrawal.paystack_transfer_code},
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal approved",
            message="Your withdrawal has been approved and is being processed.",
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal

    def _reject(self, db: Session, actor: User, withdrawal: Withdrawal, reason: str | None) -> Withdrawal:
        now = datetime.now(timezone.utc)
        withdrawal.reviewed_by = actor.id
        withdrawal.reviewed_at = now
        withdrawal.admin_id = actor.id
        withdrawal.rejected_at = now
        withdrawal.status = WithdrawalStatus.REJECTED
        withdrawal.failure_reason = reason

        if withdrawal.withdrawal_type == "savings":
            txn = transaction_repository.get_by_reference(db, _withdrawal_txn_reference(withdrawal.id))
            wallet_service.release_reserved(
                db,
                user_id=withdrawal.user_id,
                amount=withdrawal.amount,
                txn_id=txn.id if txn else None,
                description="Withdrawal rejected; funds released",
                details={"withdrawal_id": str(withdrawal.id), "failure": reason},
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.REJECT,
            category=AuditCategory.WITHDRAWAL,
            description=f"Rejected withdrawal of {withdrawal.amount} for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={"reason": reason},
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal rejected",
            message=f"Your withdrawal of {withdrawal.amount} was rejected." + (f" Reason: {reason}" if reason else ""),
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal

    def complete(self, db: Session, *, actor: User, withdrawal_id: uuid.UUID) -> Withdrawal:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        if withdrawal.status != WithdrawalStatus.APPROVED:
            raise AppException(
                message="Only approved withdrawals can be marked as completed.",
                status_code=400,
                error_code="INVALID_STATUS_TRANSITION",
            )

        withdrawal.status = WithdrawalStatus.COMPLETED
        withdrawal.completed_at = datetime.now(timezone.utc)

        if withdrawal.withdrawal_type == "savings":
            txn = transaction_repository.get_by_reference(db, _withdrawal_txn_reference(withdrawal.id))
            wallet_service.finalize_reserved(
                db,
                user_id=withdrawal.user_id,
                amount=withdrawal.amount,
                txn_id=txn.id if txn else None,
                details={"withdrawal_id": str(withdrawal.id)},
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Completed withdrawal of {withdrawal.amount} for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal completed",
            message=f"Your withdrawal of {withdrawal.amount} has been paid out.",
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal


withdrawal_service = WithdrawalService()