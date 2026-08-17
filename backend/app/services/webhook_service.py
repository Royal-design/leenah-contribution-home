from datetime import datetime, timezone
import hashlib
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import (
    AuditAction,
    AuditCategory,
    DVStatus,
    NotificationType,
    PaymentProvider,
    PaymentPurpose,
    PaymentStatus,
    TransactionStatus,
    WithdrawalStatus,
)
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.dedicated_account_repository import dedicated_account_repository
from app.repositories.payment_repository import payment_repository
from app.repositories.transaction_repository import transaction_repository
from app.repositories.user_repository import user_repository
from app.repositories.webhook_event_repository import webhook_event_repository
from app.repositories.withdrawal_repository import withdrawal_repository
from app.services.notification_service import notification_service
from app.services.wallet_service import make_reference, wallet_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash_payload(payload: dict | list) -> str:
    import json

    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _naira(kobo: int | None) -> int:
    """Paystack amounts are in kobo; the wallet ledger works in naira."""
    return int((kobo or 0) // 100)


class WebhookService:
    """Processes verified provider webhooks atomically and idempotently.

    Every event is claimed by a unique event_id before any side-effect runs.
    Duplicate deliveries return early. Financial mutation (wallet credit, ledger
    entries, withdrawal status changes) all happen inside the request's single
    transaction, so a partial failure rolls everything back and Paystack's
    retry takes over.
    """

    def handle_event(self, db: Session, *, payload: dict) -> dict[str, Any]:
        event_type = payload.get("event", "")
        data = payload.get("data") or {}
        event_id = str(data.get("id") or payload.get("id") or "")
        reference = data.get("reference")

        already, event = self._claim_event(
            db,
            event_id=event_id,
            event_type=event_type,
            reference=reference,
            payload_hash=_hash_payload(payload),
            details={"event": event_type},
        )
        if already:
            return {"processed": True, "duplicate": True}

        try:
            outcome = self._dispatch(db, event_type=event_type, data=data)
        except Exception as exc:
            if isinstance(exc, IntegrityError):
                db.rollback()
                return {"processed": True, "duplicate": True}
            webhook_event_repository.mark_failed(db, event, str(exc))
            raise

        webhook_event_repository.mark_processed(db, event)
        return {"processed": True, "outcome": outcome}

    def _claim_event(self, db: Session, *, event_id: str, event_type: str, reference: str | None, payload_hash: str, details: dict | None):
        if not event_id:
            raise AppException(
                message="Webhook event has no id.",
                status_code=400,
                error_code="INVALID_WEBHOOK",
            )

        existing = webhook_event_repository.get_by_event_id(db, event_id)
        if existing is not None:
            return True, None

        try:
            event = webhook_event_repository.create(
                db,
                provider="paystack",
                event_id=event_id,
                event_type=event_type,
                payload_hash=payload_hash,
                reference=reference,
                details=details,
            )
            db.flush()
        except IntegrityError:
            db.rollback()
            return True, None
        return False, event

    # ---------------------------------------------------------------- dispatch

    def _dispatch(self, db: Session, *, event_type: str, data: dict) -> str:
        if event_type == "charge.success":
            return self._process_charge_success(db, data)
        if event_type == "charge.failed":
            return self._process_charge_failed(db, data)
        if event_type in ("dedicatedaccount.assign.success", "dedicatedaccount.assign.failed"):
            return self._process_dedicated_account(db, event_type, data)
        if event_type in ("customeridentification.success", "customeridentification.failed"):
            return self._process_dedicated_account(db, event_type, data)
        if event_type in ("transfer.success", "transfer.failed", "transfer.reversed"):
            return self._process_transfer_event(db, event_type, data)
        return f"unhandled:{event_type}"

    # ------------------------------------------------------------------ charge

    def _process_charge_failed(self, db: Session, data: dict) -> str:
        reference = data.get("reference")
        payment = payment_repository.get_by_provider_reference(db, reference) if reference else None
        if payment is not None and payment.status == PaymentStatus.PENDING:
            payment_repository.set_status(db, payment, PaymentStatus.FAILED)
            return "payment_failed"
        return "no_pending_payment"

    def _process_charge_success(self, db: Session, data: dict) -> str:
        reference = data.get("reference")
        if not reference:
            return "missing_reference"

        payment = payment_repository.get_by_provider_reference(db, reference)
        if payment is not None and payment.status == PaymentStatus.SUCCESSFUL:
            return "already_processed"

        amount_naira = _naira(data.get("amount"))
        currency = data.get("currency") or "NGN"
        channel = data.get("channel") or "card"

        user_id = self._resolve_user_id(db, data, payment)
        if user_id is None:
            raise AppException(
                message=f"Cannot attribute payment {reference} to a user.",
                status_code=422,
                error_code="PAYMENT_UNATTRIBUTED",
            )

        if (data.get("status") or "").lower() != "success":
            if payment is not None:
                payment_repository.set_status(db, payment, PaymentStatus.FAILED)
            return "charge_not_successful"

        # Wallet credit must happen exactly once. Guard with a deterministic
        # transaction reference + the payments unique constraint below.
        txn_reference = f"PYM-{reference}"
        existing_txn = transaction_repository.get_by_reference(db, txn_reference)
        if existing_txn is not None:
            if payment is not None:
                payment_repository.set_status(db, payment, PaymentStatus.SUCCESSFUL)
            return "already_credited"

        if payment is None:
            payment = payment_repository.create(
                db,
                user_id=user_id,
                amount=amount_naira,
                currency=currency,
                provider=PaymentProvider.PAYSTACK,
                provider_reference=reference,
                internal_reference=make_reference("PYM"),
                payment_method=channel,
                purpose=PaymentPurpose.WALLET_FUNDING,
                status=PaymentStatus.SUCCESSFUL,
                details={"source": "webhook", "channel": channel},
            )
        else:
            payment_repository.set_status(db, payment, PaymentStatus.SUCCESSFUL)

        wallet_service.credit(
            db,
            user_id=user_id,
            amount=amount_naira,
            description=f"Wallet funding via {channel or 'bank transfer'}",
            reference=txn_reference,
            details={
                "method": channel or "bank_transfer",
                "paystack_reference": reference,
                "payment_id": str(payment.id),
            },
        )

        audit_log_repository.create(
            db,
            actor_id=user_id,
            actor_name="",
            actor_email="",
            actor_role=None,
            action=AuditAction.CREATE,
            category=AuditCategory.TRANSACTION,
            description=f"Wallet funded with {amount_naira} via {channel or 'bank transfer'}.",
            target=reference,
            target_id=payment.id,
            details={"amount": amount_naira, "channel": channel},
        )

        notification_service.create(
            db,
            user_id=user_id,
            title="Wallet funded",
            message=f"Your wallet has been credited with {amount_naira}.",
            type_=NotificationType.SAVINGS,
        )
        return "credited"

    def _resolve_user_id(self, db: Session, data: dict, payment) -> Any:
        if payment is not None and payment.user_id is not None:
            return payment.user_id

        customer = data.get("customer") or {}
        customer_code = customer.get("customer_code")
        if customer_code:
            user = user_repository.get_by_customer_code(db, customer_code)
            if user is not None:
                return user.id

        dedicated = data.get("dedicated_account") or {}
        account_number = dedicated.get("account_number")
        if account_number:
            dva = dedicated_account_repository.get_by_account_number(db, account_number)
            if dva is not None:
                return dva.user_id

        if customer.get("email"):
            user = user_repository.get_by_email(db, (customer.get("email") or "").lower())
            if user is not None:
                return user.id

        return None

    # ------------------------------------------------------------------- DVA

    def _process_dedicated_account(self, db: Session, event_type: str, data: dict) -> str:
        customer = data.get("customer") or {}
        customer_code = customer.get("customer_code")
        dva = None
        if customer_code:
            dva = dedicated_account_repository.get_by_customer_code(db, customer_code)
        if dva is None:
            return "no_local_dva"

        success = event_type.endswith("success")
        dva.status = DVStatus.ACTIVE if success else DVStatus.FAILED

        bank = data.get("bank") or {}
        if bank.get("name"):
            dva.bank_name = bank.get("name")
        if bank.get("slug"):
            dva.bank_slug = bank.get("slug")
        if data.get("account_number"):
            dva.account_number = data.get("account_number")
        if data.get("account_name"):
            dva.account_name = data.get("account_name")
        assignment = data.get("assignment") or {}
        if assignment.get("account_number"):
            dva.account_number = assignment.get("account_number")
        db.flush()

        if success:
            notification_service.create(
                db,
                user_id=dva.user_id,
                title="Virtual account ready",
                message=f"Fund your wallet via {dva.bank_name or 'your virtual account'} ({dva.account_number}).",
                type_=NotificationType.SAVINGS,
            )
        return "dva_assigned" if success else "dva_failed"

    # ---------------------------------------------------------------- transfer

    def _process_transfer_event(self, db: Session, event_type: str, data: dict) -> str:
        transfer_code = data.get("transfer_code")
        reference = data.get("reference")

        withdrawal = None
        if transfer_code:
            withdrawal = withdrawal_repository.get_by_transfer_code(db, transfer_code)
        if withdrawal is None and reference:
            withdrawal = withdrawal_repository.get_by_paystack_reference(db, reference)
        if withdrawal is None:
            return "unknown_withdrawal"

        status = event_type.rsplit(".", 1)[-1]
        amount_naira = _naira(data.get("amount"))
        txn_reference = f"WDL-{withdrawal.id.hex.upper()[:16]}"

        # Reversals must be processed even after a successful transfer is
        # recorded (the money returns to the user). All other terminal states
        # are immune to further webhooks.
        if status == "reversed":
            if withdrawal.status == WithdrawalStatus.REVERSED:
                return "already_final"
            if withdrawal.status == WithdrawalStatus.COMPLETED:
                wallet_service.revert_withdrawal(
                    db,
                    user_id=withdrawal.user_id,
                    amount=withdrawal.amount,
                    description="Reversed withdrawal credited back to wallet",
                    reference=make_reference("REV"),
                    details={"transfer_code": transfer_code, "withdrawal_id": str(withdrawal.id)},
                )
            else:
                txn = transaction_repository.get_by_reference(db, txn_reference)
                wallet_service.release_reserved(
                    db,
                    user_id=withdrawal.user_id,
                    amount=withdrawal.amount,
                    txn_id=txn.id if txn else None,
                    description="Transfer reversed before completion",
                    details={"transfer_code": transfer_code, "withdrawal_id": str(withdrawal.id)},
                )
            withdrawal.status = WithdrawalStatus.REVERSED
            withdrawal.completed_at = _utcnow()
            self._audit(db, withdrawal, "Paystack transfer reversed", AuditAction.REVERT)
            notification_service.create(
                db,
                user_id=withdrawal.user_id,
                title="Withdrawal reversed",
                message="A previous transfer was reversed. The amount has been credited back to your wallet.",
                type_=NotificationType.WITHDRAWAL,
            )
            return "reversed"

        if withdrawal.status in (WithdrawalStatus.COMPLETED, WithdrawalStatus.REVERSED, WithdrawalStatus.FAILED, WithdrawalStatus.REJECTED):
            return "already_final"

        if status == "success":
            if withdrawal.withdrawal_type == "savings":
                txn = transaction_repository.get_by_reference(db, txn_reference)
                wallet_service.finalize_reserved(
                    db,
                    user_id=withdrawal.user_id,
                    amount=withdrawal.amount,
                    txn_id=txn.id if txn else None,
                    details={"transfer_code": transfer_code, "withdrawal_id": str(withdrawal.id)},
                )
            withdrawal.status = WithdrawalStatus.COMPLETED
            withdrawal.completed_at = _utcnow()
            self._audit(db, withdrawal, "Paystack transfer completed", AuditAction.UPDATE)
            notification_service.create(
                db,
                user_id=withdrawal.user_id,
                title="Withdrawal completed",
                message=f"Your withdrawal of {withdrawal.amount} has been paid out.",
                type_=NotificationType.WITHDRAWAL,
            )
            return "completed"

        if status == "failed":
            reason = data.get("failure_reason") or data.get("reason") or "Transfer failed"
            if withdrawal.withdrawal_type == "savings":
                txn = transaction_repository.get_by_reference(db, txn_reference)
                wallet_service.release_reserved(
                    db,
                    user_id=withdrawal.user_id,
                    amount=withdrawal.amount,
                    txn_id=txn.id if txn else None,
                    description="Withdrawal failed; funds released",
                    details={"transfer_code": transfer_code, "failure": reason, "withdrawal_id": str(withdrawal.id)},
                )
            withdrawal.status = WithdrawalStatus.FAILED
            withdrawal.failure_reason = reason
            withdrawal.completed_at = _utcnow()
            self._audit(db, withdrawal, f"Paystack transfer failed: {reason}", AuditAction.REJECT)
            notification_service.create(
                db,
                user_id=withdrawal.user_id,
                title="Withdrawal failed",
                message=f"Your withdrawal of {withdrawal.amount} failed. Funds have been returned to your wallet.",
                type_=NotificationType.WITHDRAWAL,
            )
            return "failed"

        return "unknown_status"

    def _audit(self, db: Session, withdrawal, description: str, action: AuditAction) -> None:
        audit_log_repository.create(
            db,
            actor_id=None,
            actor_name="paystack",
            actor_email="paystack@webhooks",
            actor_role=None,
            action=action,
            category=AuditCategory.WITHDRAWAL,
            description=description,
            target=withdrawal.destination,
            target_id=withdrawal.id,
            details={"amount": withdrawal.amount, "status": withdrawal.status.value},
        )


webhook_service = WebhookService()