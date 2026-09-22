from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import (
    AuditAction,
    AuditCategory,
    NotificationType,
    PayoutStatus,
    TransactionStatus,
    TransactionType,
    WithdrawalChannel,
    WithdrawalSource,
    WithdrawalStatus,
)
from app.models.contribution import Contribution
from app.models.user import User
from app.models.withdrawal import Withdrawal
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.contribution_repository import (
    contribution_member_repository,
    contribution_payout_repository,
    contribution_repository,
)
from app.repositories.savings_plan_repository import (
    savings_plan_enrollment_repository,
    savings_plan_repository,
)
from app.repositories.savings_repository import savings_account_repository
from app.repositories.transaction_repository import transaction_repository
from app.repositories.withdrawal_repository import withdrawal_repository
from app.schemas.withdrawal import WithdrawalOut
from app.services.bank_account_service import bank_account_service
from app.services.commission_service import (
    ADMIN_PAYOUT,
    CONTRIBUTION_WITHDRAWAL,
    EMERGENCY_WITHDRAWAL,
    SAVINGS_WITHDRAWAL,
    WALLET_WITHDRAWAL,
    commission_service,
)
from app.services.notification_service import notification_service
from app.services.payment_provider import payment_provider
from app.services.wallet_service import make_reference, wallet_service


def _make_reference() -> str:
    from datetime import datetime as dt

    return f"WDL-{dt.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"


def _mask_account(number: str | None) -> str:
    if not number:
        return ""
    return f"****{number[-4:]}"


def _withdrawal_txn_reference(withdrawal_id: uuid.UUID) -> str:
    return f"WDL-{withdrawal_id.hex.upper()[:16]}"


def _completion_txn_reference(withdrawal_id: uuid.UUID) -> str:
    return f"WDLT-{withdrawal_id.hex.upper()[:16]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _gross(of: Withdrawal) -> int:
    return of.gross_amount if of.gross_amount is not None else of.amount


def _net(of: Withdrawal) -> int:
    return of.net_amount if of.net_amount is not None else of.amount


class WithdrawalService:
    # -------------------------------------------------------------- ownership

    def _serialize(self, withdrawal: Withdrawal) -> WithdrawalOut:
        out = WithdrawalOut.model_validate(withdrawal)
        user = withdrawal.user
        if user is not None:
            out = out.model_copy(
                update={"user_name": f"{user.first_name} {user.last_name}".strip()}
            )
        return out

    def _own(self, db: Session, withdrawal_id: uuid.UUID, user_id: uuid.UUID) -> Withdrawal:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None or withdrawal.user_id != user_id:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        return withdrawal

    # ------------------------------------------------------- validation

    def _resolve_bank(
        self,
        db: Session,
        *,
        user: User,
        withdrawal_type: str,
        channel: WithdrawalChannel,
        bank_account_id: uuid.UUID | None,
        bank_name: str | None,
        account_number: str | None,
        account_name: str | None,
        destination: str | None,
    ) -> tuple[WithdrawalChannel, str | None, str | None, str | None, str | None, str | None, uuid.UUID | None]:
        recipient_code = None
        if channel == WithdrawalChannel.WALLET:
            return channel, None, None, None, "Platform wallet", None, None

        if bank_account_id is not None:
            account = bank_account_service._own(db, user.id, bank_account_id)
            if not account.is_verified or not account.provider_recipient_code:
                raise AppException(
                    message="Only verified bank accounts can receive withdrawals.",
                    status_code=400,
                    error_code="UNVERIFIED_BANK_ACCOUNT",
                )
            return (
                channel,
                account.bank_name,
                account.account_number,
                account.account_name,
                f"{_mask_account(account.account_number)} {account.bank_name}",
                account.provider_recipient_code,
                account.id,
            )

        if not (bank_name and account_number):
            raise AppException(
                message="Bank details are required for a bank withdrawal.",
                status_code=400,
                error_code="BANK_DETAILS_REQUIRED",
            )
        return (
            channel,
            bank_name,
            account_number,
            account_name,
            destination or f"{_mask_account(account_number)} {bank_name}",
            recipient_code,
            bank_account_id,
        )

    def _savings_plan_eligibility(
        self,
        db: Session,
        *,
        user: User,
        savings_plan_id: uuid.UUID,
        amount: int,
        emergency: bool,
    ) -> tuple[str, int]:
        plan = savings_plan_repository.get(db, savings_plan_id)
        if plan is None:
            raise AppException(message="Savings plan not found.", status_code=404, error_code="SAVINGS_PLAN_NOT_FOUND")
        enrollment = savings_plan_enrollment_repository.get(db, savings_plan_id, user.id)
        if enrollment is None or enrollment.status.value != "active":
            raise AppException(
                message="You are not enrolled in this savings plan.",
                status_code=403,
                error_code="NOT_ENROLLED",
            )
        if not emergency and plan.status.value != "completed":
            raise AppException(
                message="This savings plan has not reached completion. You may request an emergency withdrawal instead.",
                status_code=400,
                error_code="PLAN_NOT_COMPLETED",
            )

        withdrawn = withdrawal_repository.sum_gross_for_plan(db, savings_plan_id=savings_plan_id, user_id=user.id)
        remaining = enrollment.total_saved - withdrawn
        if amount > remaining:
            raise AppException(
                message=f"Requested amount exceeds your available savings in this plan ({remaining}).",
                status_code=400,
                error_code="INSUFFICIENT_PLAN_BALANCE",
            )
        return plan.name, remaining

    def _contribution_eligibility(
        self,
        db: Session,
        *,
        user: User,
        contribution_id: uuid.UUID | None,
        amount: int,
        emergency: bool,
    ) -> tuple[Contribution | None, str | None, int]:
        if contribution_id is None:
            return None, None, 0

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
        if not emergency and rule.get("type") == "fixed_date" and fixed_date is not None:
            now = _utcnow()
            fixed = fixed_date.replace(tzinfo=timezone.utc) if fixed_date.tzinfo is None else fixed_date
            if now < fixed:
                raise AppException(
                    message=f"This contribution is locked until {fixed.strftime('%d %b %Y')}.",
                    status_code=400,
                    error_code="CONTRIBUTION_LOCKED",
                    detail=f"unlock_at={fixed.isoformat()}",
                )

        capacity = self._contribution_capacity(db, contribution_id, member.id, amount, emergency)
        return contribution, contribution.name, capacity

    def _contribution_capacity(
        self,
        db: Session,
        contribution_id: uuid.UUID,
        member_id: uuid.UUID,
        amount: int,
        emergency: bool,
    ) -> int:
        """How much a member can still take out of this contribution.

        For emergencies this is bounded by the member's remaining payout
        entitlement AND the pot actually collected so far, so an exceptional
        early payout can never exceed what the pool can support.
        """
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            return 0

        payouts = contribution_payout_repository.list_for_member(db, contribution_id, member_id)
        entitlement_remaining = sum(p.amount for p in payouts if p.status == PayoutStatus.PENDING)
        if entitlement_remaining <= 0:
            return 0

        if not emergency:
            if amount > entitlement_remaining:
                raise AppException(
                    message="Requested amount exceeds your contribution payout entitlement.",
                    status_code=400,
                    error_code="AMOUNT_EXCEEDS_CONTRIBUTION",
                )
            return entitlement_remaining

        # Emergency: bound by the collected pot minus already-committed funds.
        pot_committed = 0
        for payout in contribution_payout_repository.list_for_contribution(db, contribution_id):
            if payout.status == PayoutStatus.PAID and payout.gross_amount is not None:
                pot_committed += payout.gross_amount
        pot_committed += withdrawal_repository.sum_gross_for_contribution(db, contribution_id=contribution_id)

        pot_available = contribution.total_contributed - pot_committed
        return min(entitlement_remaining, max(pot_available, 0))

    def _commission_key(self, source: WithdrawalSource) -> str:
        if source == WithdrawalSource.EMERGENCY:
            return EMERGENCY_WITHDRAWAL
        if source == WithdrawalSource.SAVINGS_PLAN:
            return SAVINGS_WITHDRAWAL
        if source == WithdrawalSource.CONTRIBUTION:
            return CONTRIBUTION_WITHDRAWAL
        if source == WithdrawalSource.ADMIN:
            return ADMIN_PAYOUT
        return WALLET_WITHDRAWAL

    # ---------------------------------------------------------------- request

    def preview(
        self,
        db: Session,
        *,
        user: User,
        amount: int,
        withdrawal_type: str,
        channel: str | None = None,
        source: str | None = None,
        savings_plan_id: uuid.UUID | None = None,
        contribution_id: uuid.UUID | None = None,
    ) -> dict:
        """Return the authoritative commission breakdown for a prospective
        withdrawal WITHOUT creating anything or moving money.

        The frontend uses this so the amount → commission → net numbers the
        user reviews are exactly what the backend will freeze on submission.
        """
        if amount <= 0:
            raise AppException(message="Amount must be greater than zero.", status_code=400, error_code="INVALID_AMOUNT")
        if withdrawal_type not in ("savings", "contribution"):
            raise AppException(message="Invalid withdrawal type.", status_code=400, error_code="INVALID_WITHDRAWAL_TYPE")

        emergency = source == "emergency"
        base_source = WithdrawalSource.WALLET
        if savings_plan_id is not None:
            base_source = WithdrawalSource.SAVINGS_PLAN
        elif contribution_id is not None or withdrawal_type == "contribution":
            base_source = WithdrawalSource.CONTRIBUTION

        plan = None
        contribution = None
        if base_source == WithdrawalSource.SAVINGS_PLAN:
            plan = savings_plan_repository.get(db, savings_plan_id)
        elif base_source == WithdrawalSource.CONTRIBUTION and contribution_id is not None:
            contribution = contribution_repository.get(db, contribution_id)

        if source == "admin":
            resolved_source = WithdrawalSource.ADMIN
        else:
            resolved_source = WithdrawalSource.EMERGENCY if emergency else base_source
        commission = commission_service.resolve(
            db,
            key=self._commission_key(resolved_source),
            amount=amount,
            plan=plan,
            contribution=contribution,
        )
        return {
            "amount": amount,
            "source": resolved_source.value,
            "channel": channel or ("bank" if not resolved_source == WithdrawalSource.EMERGENCY else "wallet"),
            "gross": amount,
            "commission": commission.get("commission"),
            "commission_rate": float(commission.get("rate")) if commission.get("rate") is not None else None,
            "commission_type": commission.get("type"),
            "fee": commission.get("fixed"),
            "net": commission.get("net"),
        }

    def request(
        self,
        db: Session,
        *,
        user: User,
        amount: int,
        withdrawal_type: str,
        channel: str | None = None,
        source: str | None = None,
        reason: str | None = None,
        bank_account_id: uuid.UUID | None = None,
        bank_name: str | None = None,
        account_number: str | None = None,
        account_name: str | None = None,
        destination: str | None = None,
        contribution_id: uuid.UUID | None = None,
        savings_plan_id: uuid.UUID | None = None,
    ) -> Withdrawal:
        if withdrawal_type not in ("savings", "contribution"):
            raise AppException(message="Invalid withdrawal type.", status_code=400, error_code="INVALID_WITHDRAWAL_TYPE")
        if amount <= 0:
            raise AppException(message="Amount must be greater than zero.", status_code=400, error_code="INVALID_AMOUNT")

        emergency = source == "emergency"
        is_contribution_base = contribution_id is not None or withdrawal_type == "contribution"

        base_source = WithdrawalSource.WALLET
        if savings_plan_id is not None:
            base_source = WithdrawalSource.SAVINGS_PLAN
        elif is_contribution_base:
            base_source = WithdrawalSource.CONTRIBUTION

        # Emergency keeps its own source so admins can filter it, while the
        # related plan/contribution (or the wallet) supplies the money.
        resolved_source = WithdrawalSource.EMERGENCY if emergency else base_source

        if resolved_source == WithdrawalSource.EMERGENCY and (not reason or not reason.strip()):
            raise AppException(
                message="A reason is required for an emergency withdrawal.",
                status_code=400,
                error_code="REASON_REQUIRED",
            )
        if base_source == WithdrawalSource.CONTRIBUTION and contribution_id is None:
            raise AppException(
                message="contribution_id is required for contribution withdrawals.",
                status_code=400,
                error_code="CONTRIBUTION_ID_REQUIRED",
            )

        if channel is None:
            channel = "bank" if (bank_account_id or (bank_name and account_number)) else "wallet"
        if channel not in ("wallet", "bank"):
            raise AppException(message="Invalid withdrawal channel.", status_code=400, error_code="INVALID_CHANNEL")
        channel = WithdrawalChannel(channel)

        # Resolve bank details (unless the money stays in the platform wallet).
        bank_meta = None
        if channel == WithdrawalChannel.BANK:
            bank_meta = self._resolve_bank(
                db,
                user=user,
                withdrawal_type=withdrawal_type,
                channel=channel,
                bank_account_id=bank_account_id,
                bank_name=bank_name,
                account_number=account_number,
                account_name=account_name,
                destination=destination,
            )
        else:
            bank_meta = (channel, None, None, None, "Platform wallet", None, None)
        _, bank_name, account_number, account_name, destination, recipient_code, bank_account_id = bank_meta

        plan = None
        contribution = None
        contribution_name = None

        # Money-source validation + capacity.
        if base_source == WithdrawalSource.SAVINGS_PLAN:
            if withdrawal_type != "savings":
                raise AppException(
                    message="Savings plan withdrawals must use withdrawal_type savings.",
                    status_code=400,
                    error_code="INVALID_WITHDRAWAL_TYPE",
                )
            _, _ = self._savings_plan_eligibility(
                db, user=user, savings_plan_id=savings_plan_id, amount=amount, emergency=emergency
            )
            plan = savings_plan_repository.get(db, savings_plan_id)

        elif base_source == WithdrawalSource.CONTRIBUTION:
            contribution, contribution_name, _ = self._contribution_eligibility(
                db, user=user, contribution_id=contribution_id, amount=amount, emergency=emergency
            )

        else:  # wallet-backed (including emergency without a plan)
            account = savings_account_repository.get_for_user(db, user.id)
            balance = account.balance if account else 0
            if amount > balance:
                raise AppException(
                    message="Insufficient wallet balance for this withdrawal.",
                    status_code=400,
                    error_code="INSUFFICIENT_BALANCE",
                )

        if withdrawal_repository.exists_pending_duplicate(
            db,
            user_id=user.id,
            withdrawal_type=withdrawal_type,
            amount=amount,
            channel=channel,
        ):
            raise AppException(
                message="A matching withdrawal request is already pending. Please wait for it to be reviewed.",
                status_code=400,
                error_code="DUPLICATE_WITHDRAWAL",
            )

        # Freeze commission at request time so the admin approval dialog and the
        # ledger always agree, regardless of later config changes.
        commission = commission_service.resolve(
            db,
            key=self._commission_key(resolved_source),
            amount=amount,
            plan=plan,
            contribution=contribution,
        )

        withdrawal = withdrawal_repository.create(
            db,
            user_id=user.id,
            amount=amount,
            withdrawal_type=withdrawal_type,
            channel=channel,
            source=resolved_source,
            reason=reason,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            destination=destination,
            contribution_name=contribution_name,
            bank_account_id=bank_account_id,
            paystack_recipient_code=recipient_code,
            related_savings_plan_id=savings_plan_id,
            related_contribution_id=contribution_id,
            gross_amount=amount,
            commission_rate=commission.get("rate"),
            commission_type=commission.get("type"),
            commission_amount=commission.get("commission"),
            fee_amount=commission.get("fixed"),
            net_amount=commission.get("net"),
        )

        # Only wallet-backed withdrawals lock money at request time. Pot-based
        # sources (plan/contribution) only pay out on approval.
        if base_source == WithdrawalSource.WALLET:
            wallet_service.reserve(
                db,
                user_id=user.id,
                amount=amount,
                description=f"Withdrawal to {destination}",
                reference=_withdrawal_txn_reference(withdrawal.id),
                details={"withdrawal_id": str(withdrawal.id), "bank": bank_name, "method": "wallet"},
                commission_rate=commission.get("rate"),
                commission_type=commission.get("type"),
                commission_amount=commission.get("commission"),
                fee_amount=commission.get("fixed"),
                net_amount=commission.get("net"),
                source=resolved_source.value,
                related_savings_plan_id=savings_plan_id,
                related_contribution_id=contribution_id,
                related_emergency_request_id=withdrawal.id if emergency else None,
            )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Requested {withdrawal_type} withdrawal of {amount} ({resolved_source.value} → {channel.value}).",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={
                "channel": channel.value,
                "source": resolved_source.value,
                "reason": reason,
                "commission": commission.get("commission"),
                "net": commission.get("net"),
                "bank_account_id": str(bank_account_id) if bank_account_id else None,
            },
        )

        notification_service.notify_admins(
            db,
            title="New withdrawal request",
            message=(
                f"{user.first_name} {user.last_name} requested a {withdrawal_type} withdrawal "
                f"of {amount} ({resolved_source.value}{'/EMERGENCY' if emergency else ''})."
            ),
            type_=NotificationType.WITHDRAWAL,
        )
        return withdrawal

    # ------------------------------------------------------------ listing/get

    def list_mine(self, db: Session, *, user: User, status: WithdrawalStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = withdrawal_repository.list_mine(db, user.id, status=status, page=page, page_size=page_size)
        return {
            "items": [self._serialize(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def list_all(self, db: Session, *, status: WithdrawalStatus | None = None, source: str | None = None, page: int = 1, page_size: int = 20):
        items, total = withdrawal_repository.list_all(db, status=status, source=source, page=page, page_size=page_size)
        return {
            "items": [self._serialize(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def get(self, db: Session, *, user: User, withdrawal_id: uuid.UUID) -> WithdrawalOut:
        return self._serialize(self._own(db, withdrawal_id, user.id))

    def get_for_admin(self, db: Session, *, withdrawal_id: uuid.UUID) -> WithdrawalOut:
        withdrawal = withdrawal_repository.get(db, withdrawal_id)
        if withdrawal is None:
            raise AppException(message="Withdrawal not found.", status_code=404, error_code="WITHDRAWAL_NOT_FOUND")
        return self._serialize(withdrawal)

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
            return self._approve(db, actor, withdrawal, reason)
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

    # -------------------------------------------------------- fund conservation

    def _consume_contribution_pot(self, db: Session, withdrawal: Withdrawal, amount: int) -> None:
        """Reduce the member's remaining payout so early payouts and rotational
        payouts can never both be paid for the same entitlement."""
        if withdrawal.related_contribution_id is None:
            return
        member = contribution_member_repository.get(db, withdrawal.related_contribution_id, withdrawal.user_id)
        if member is None:
            return
        for payout in contribution_payout_repository.list_for_member(db, withdrawal.related_contribution_id, member.id):
            if payout.status == PayoutStatus.PENDING:
                payout.amount = max(payout.amount - amount, 0)
                if payout.amount <= 0:
                    payout.status = PayoutStatus.SKIPPED
                    payout.admin_note = f"Paid out via withdrawal {withdrawal.id}"
                db.flush()
                return

    def _restore_contribution_pot(self, db: Session, withdrawal: Withdrawal) -> None:
        """Replenish a member's payout after a withdrawal is reversed/failed."""
        if withdrawal.related_contribution_id is None:
            return
        if _gross(withdrawal) <= 0:
            return
        member = contribution_member_repository.get(db, withdrawal.related_contribution_id, withdrawal.user_id)
        if member is None:
            return
        for payout in contribution_payout_repository.list_for_member(db, withdrawal.related_contribution_id, member.id):
            if payout.status in (PayoutStatus.PENDING, PayoutStatus.SKIPPED):
                payout.amount = payout.amount + _gross(withdrawal)
                payout.status = PayoutStatus.PENDING
                payout.admin_note = None
                db.flush()
                return

    def _record_pot_transaction(self, db: Session, withdrawal: Withdrawal, *, status: TransactionStatus) -> None:
        """Create the ledger entry for a pot-based payout (no reservation)."""
        reference = _completion_txn_reference(withdrawal.id)
        existing = transaction_repository.get_by_reference(db, reference)
        if existing is not None:
            return
        transaction_repository.create(
            db,
            user_id=withdrawal.user_id,
            type_=TransactionType.WITHDRAWAL,
            status=status,
            amount=_net(withdrawal),
            description=f"{withdrawal.withdrawal_type.title()} withdrawal to {withdrawal.destination}",
            reference=reference,
            details={"withdrawal_id": str(withdrawal.id), "source": withdrawal.source.value},
            gross_amount=_gross(withdrawal),
            commission_rate=withdrawal.commission_rate,
            commission_type=withdrawal.commission_type,
            commission_amount=withdrawal.commission_amount,
            fee_amount=withdrawal.fee_amount,
            net_amount=_net(withdrawal),
            source=withdrawal.source.value,
            related_savings_plan_id=withdrawal.related_savings_plan_id,
            related_contribution_id=withdrawal.related_contribution_id,
            related_withdrawal_id=withdrawal.id,
            related_emergency_request_id=withdrawal.id if withdrawal.source == WithdrawalSource.EMERGENCY else None,
            completed_at=withdrawal.completed_at or _utcnow(),
            approved_by=withdrawal.admin_id,
            approved_at=withdrawal.approved_at,
        )

    # ---------------------------------------------------------------- approve

    def _approve(self, db: Session, actor: User, withdrawal: Withdrawal, reason: str | None = None) -> Withdrawal:
        now = _utcnow()

        withdrawal.reviewed_by = actor.id
        withdrawal.reviewed_at = now
        withdrawal.admin_id = actor.id
        withdrawal.approved_at = now

        net = _net(withdrawal)
        gross = _gross(withdrawal)

        if withdrawal.channel == WithdrawalChannel.WALLET:
            # Money stays in the platform: settle the pot / credit the wallet.
            reserved_txn = transaction_repository.get_by_reference(db, _withdrawal_txn_reference(withdrawal.id))
            if reserved_txn is not None:
                # Wallet-backed: release the hold and credit the net amount.
                wallet_service.finalize_reserved(
                    db,
                    user_id=withdrawal.user_id,
                    amount=gross,
                    txn_id=reserved_txn.id,
                    details={"withdrawal_id": str(withdrawal.id), "channel": "wallet"},
                )
                if net > 0:
                    wallet_service.credit(
                        db,
                        user_id=withdrawal.user_id,
                        amount=net,
                        description=f"Withdrawal settled to wallet from {withdrawal.destination}",
                        reference=make_reference("WLS"),
                        type_=TransactionType.WITHDRAWAL,
                        details={"withdrawal_id": str(withdrawal.id), "method": "wallet", "channel": "wallet", "source": withdrawal.source.value},
                        commission_rate=withdrawal.commission_rate,
                        commission_type=withdrawal.commission_type,
                        commission_amount=withdrawal.commission_amount,
                        fee_amount=withdrawal.fee_amount,
                        gross_amount=gross,
                        net_amount=net,
                        source=withdrawal.source.value,
                        related_savings_plan_id=withdrawal.related_savings_plan_id,
                        related_contribution_id=withdrawal.related_contribution_id,
                        related_withdrawal_id=withdrawal.id,
                        related_emergency_request_id=withdrawal.id if withdrawal.source == WithdrawalSource.EMERGENCY else None,
                    )
            else:
                # Pot-based source: deliver the net amount to the wallet now.
                if net > 0:
                    wallet_service.credit(
                        db,
                        user_id=withdrawal.user_id,
                        amount=net,
                        description=f"{withdrawal.withdrawal_type.title()} withdrawal to wallet",
                        reference=make_reference("WLP"),
                        type_=TransactionType.WITHDRAWAL,
                        details={"withdrawal_id": str(withdrawal.id), "method": "wallet", "channel": "wallet", "source": withdrawal.source.value},
                        commission_rate=withdrawal.commission_rate,
                        commission_type=withdrawal.commission_type,
                        commission_amount=withdrawal.commission_amount,
                        fee_amount=withdrawal.fee_amount,
                        gross_amount=gross,
                        net_amount=net,
                        source=withdrawal.source.value,
                        related_savings_plan_id=withdrawal.related_savings_plan_id,
                        related_contribution_id=withdrawal.related_contribution_id,
                        related_withdrawal_id=withdrawal.id,
                        related_emergency_request_id=withdrawal.id if withdrawal.source == WithdrawalSource.EMERGENCY else None,
                    )
                if withdrawal.related_contribution_id is not None:
                    self._consume_contribution_pot(db, withdrawal, gross)
                self._record_pot_transaction(db, withdrawal, status=TransactionStatus.SUCCESSFUL)

            withdrawal.status = WithdrawalStatus.COMPLETED
            withdrawal.completed_at = now
        else:
            # Bank payout: initiate the provider transfer for the NET amount.
            recipient_code = (
                withdrawal.paystack_recipient_code
                or (withdrawal.bank_account.provider_recipient_code if withdrawal.bank_account else None)
            )
            if not recipient_code:
                raise AppException(
                    message="This withdrawal has no verified payout recipient. Ask the user to re-add their bank account.",
                    status_code=400,
                    error_code="PAYSTACK_RECIPIENT_REQUIRED",
                )
            reference = f"TRF-{withdrawal.id.hex.upper()[:16]}"
            transfer = payment_provider.transfer(
                recipient_code=recipient_code,
                amount=net * 100,  # kobo
                reference=reference,
                reason=f"LCH withdrawal {net}",
            )
            withdrawal.paystack_transfer_code = transfer.get("transfer_code")
            withdrawal.paystack_reference = reference
            withdrawal.status = WithdrawalStatus.PROCESSING

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.APPROVE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Approved withdrawal of {gross} (net {net}) for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={
                "reason": reason,
                "channel": withdrawal.channel.value,
                "source": withdrawal.source.value,
                "gross": gross,
                "commission": withdrawal.commission_amount,
                "net": net,
                "transfer_code": withdrawal.paystack_transfer_code,
            },
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal approved",
            message=(
                "Your withdrawal has been approved and is being processed."
                if withdrawal.status == WithdrawalStatus.PROCESSING
                else "Your withdrawal has been completed and credited to your wallet."
            ),
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal

    # ---------------------------------------------------------------- reject

    def _reject(self, db: Session, actor: User, withdrawal: Withdrawal, reason: str | None) -> Withdrawal:
        now = _utcnow()
        withdrawal.reviewed_by = actor.id
        withdrawal.reviewed_at = now
        withdrawal.admin_id = actor.id
        withdrawal.rejected_at = now
        withdrawal.status = WithdrawalStatus.REJECTED
        withdrawal.failure_reason = reason

        reserved_txn = transaction_repository.get_by_reference(db, _withdrawal_txn_reference(withdrawal.id))
        if reserved_txn is not None:
            wallet_service.release_reserved(
                db,
                user_id=withdrawal.user_id,
                amount=_gross(withdrawal),
                txn_id=reserved_txn.id,
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
            description=f"Rejected withdrawal of {_gross(withdrawal)} for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={"reason": reason},
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal rejected",
            message=f"Your withdrawal of {_gross(withdrawal)} was rejected." + (f" Reason: {reason}" if reason else ""),
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal

    # ---------------------------------------------------------------- complete

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
        withdrawal.completed_at = _utcnow()

        reserved_txn = transaction_repository.get_by_reference(db, _withdrawal_txn_reference(withdrawal.id))
        if reserved_txn is not None:
            wallet_service.finalize_reserved(
                db,
                user_id=withdrawal.user_id,
                amount=_gross(withdrawal),
                txn_id=reserved_txn.id,
                details={"withdrawal_id": str(withdrawal.id)},
            )
        else:
            if withdrawal.related_contribution_id is not None:
                self._consume_contribution_pot(db, withdrawal, _gross(withdrawal))
            self._record_pot_transaction(db, withdrawal, status=TransactionStatus.SUCCESSFUL)

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Completed withdrawal of {_gross(withdrawal)} for user {withdrawal.user_id}.",
            target=withdrawal.destination,
            target_id=withdrawal.id,
        )

        notification_service.create(
            db,
            user_id=withdrawal.user_id,
            title="Withdrawal completed",
            message=f"Your withdrawal of {_net(withdrawal)} has been paid out.",
            type_=NotificationType.WITHDRAWAL,
        )
        db.flush()
        return withdrawal

    # ----------------------------------------------------------- admin payout

    def admin_payout(
        self,
        db: Session,
        *,
        actor: User,
        user: User,
        amount: int,
        channel: str,
        reason: str | None,
        bank_account_id: uuid.UUID | None = None,
        savings_plan_id: uuid.UUID | None = None,
        contribution_id: uuid.UUID | None = None,
        admin_note: str | None = None,
    ) -> Withdrawal:
        """Admin-initiated payout on behalf of a user.

        Explicitly recorded and audited: which admin, which user, amount,
        destination, reason, related plan, reference and commission. Money is
        either transferred (bank) or settled to the platform wallet (wallet).
        """
        if amount <= 0:
            raise AppException(message="Amount must be greater than zero.", status_code=400, error_code="INVALID_AMOUNT")
        if channel not in ("wallet", "bank"):
            raise AppException(message="Invalid withdrawal channel.", status_code=400, error_code="INVALID_CHANNEL")

        resolved_source = WithdrawalSource.WALLET
        if savings_plan_id is not None:
            resolved_source = WithdrawalSource.SAVINGS_PLAN
        elif contribution_id is not None:
            resolved_source = WithdrawalSource.CONTRIBUTION

        plan = None
        contribution = None
        if resolved_source == WithdrawalSource.SAVINGS_PLAN:
            plan = savings_plan_repository.get(db, savings_plan_id)
            if plan is None:
                raise AppException(message="Savings plan not found.", status_code=404, error_code="SAVINGS_PLAN_NOT_FOUND")
            withdrawn = withdrawal_repository.sum_gross_for_plan(db, savings_plan_id=savings_plan_id, user_id=user.id)
            enrollment = savings_plan_enrollment_repository.get(db, savings_plan_id, user.id)
            if enrollment is None:
                raise AppException(message="User is not enrolled in this savings plan.", status_code=400, error_code="NOT_ENROLLED")
            if amount > enrollment.total_saved - withdrawn:
                raise AppException(
                    message="Requested amount exceeds the user's available savings in this plan.",
                    status_code=400,
                    error_code="INSUFFICIENT_PLAN_BALANCE",
                )
        elif resolved_source == WithdrawalSource.CONTRIBUTION:
            contribution, _, _ = self._contribution_eligibility(
                db, user=user, contribution_id=contribution_id, amount=amount, emergency=True
            )

        # Bank details for an admin-initiated bank payout.
        destination = "Platform wallet"
        recipient_code = None
        resolution_bank_id = bank_account_id
        if channel == "bank":
            bank_meta = self._resolve_bank(
                db,
                user=user,
                withdrawal_type="savings",
                channel=WithdrawalChannel.BANK,
                bank_account_id=bank_account_id,
                bank_name=None,
                account_number=None,
                account_name=None,
                destination=None,
            )
            (_, bank_name, account_number, account_name, destination, recipient_code, resolution_bank_id) = bank_meta
        else:
            bank_name, account_number, account_name = None, None, None

        commission = commission_service.resolve(
            db,
            key=self._commission_key(WithdrawalSource.ADMIN),
            amount=amount,
            plan=plan,
            contribution=contribution,
        )

        withdrawal = withdrawal_repository.create(
            db,
            user_id=user.id,
            amount=amount,
            withdrawal_type="savings" if savings_plan_id else "contribution" if contribution_id else "savings",
            channel=WithdrawalChannel(channel),
            source=WithdrawalSource.ADMIN,
            reason=reason,
            admin_note=admin_note,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            destination=destination,
            bank_account_id=resolution_bank_id,
            paystack_recipient_code=recipient_code,
            related_savings_plan_id=savings_plan_id,
            related_contribution_id=contribution_id,
            gross_amount=amount,
            commission_rate=commission.get("rate"),
            commission_type=commission.get("type"),
            commission_amount=commission.get("commission"),
            fee_amount=commission.get("fixed"),
            net_amount=commission.get("net"),
        )

        # Hold wallet funds while processing, matching the user-request path.
        if resolved_source == WithdrawalSource.WALLET:
            account = savings_account_repository.get_for_user(db, user.id)
            if account is None or account.balance < amount:
                raise AppException(
                    message="Insufficient wallet balance for this payout.",
                    status_code=400,
                    error_code="INSUFFICIENT_BALANCE",
                )
            wallet_service.reserve(
                db,
                user_id=user.id,
                amount=amount,
                description=f"Admin payout to {destination}",
                reference=_withdrawal_txn_reference(withdrawal.id),
                details={"withdrawal_id": str(withdrawal.id), "admin_id": str(actor.id)},
                commission_rate=commission.get("rate"),
                commission_type=commission.get("type"),
                commission_amount=commission.get("commission"),
                fee_amount=commission.get("fixed"),
                net_amount=commission.get("net"),
                source="admin",
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.CREATE,
            category=AuditCategory.WITHDRAWAL,
            description=f"Admin initiated payout of {amount} for user {user.id}. Reason: {reason or '(none)'}.",
            target=destination,
            target_id=withdrawal.id,
            details={
                "channel": channel,
                "source": resolved_source.value,
                "reason": reason,
                "admin_note": admin_note,
                "commission": commission.get("commission"),
                "net": commission.get("net"),
                "savings_plan_id": str(savings_plan_id) if savings_plan_id else None,
                "contribution_id": str(contribution_id) if contribution_id else None,
            },
        )
        db.flush()

        # Payouts are executed immediately by the initiating admin.
        return self._approve(db, actor, withdrawal, reason=reason or admin_note)


withdrawal_service = WithdrawalService()