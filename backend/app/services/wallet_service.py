import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import TransactionStatus, TransactionType
from app.models.savings_account import SavingsAccount
from app.models.transaction import Transaction
from app.repositories.savings_repository import savings_account_repository
from app.repositories.transaction_repository import transaction_repository


def make_reference(prefix: str) -> str:
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8].upper()}"


class WalletService:
    """Internal wallet ledger.

    Every financial movement must flow through here and produce a Transaction
    record. Paystack (CARD / BANK_TRANSFER) sits in front of `credit`;
    contribution business logic calls `debit`. Nothing here talks to a payment
    provider.

    Balance model:
        balance  = funds available to spend right now
        reserved = funds locked behind a pending withdrawal
        total    = balance + reserved
    Reserving moves money from `balance` into `reserved`; releasing (rejection
    / transfer failure) moves it back; a successful payout removes it from
    `reserved` permanently. Reserved money can never be spent.
    """

    def _get_account(self, db: Session, user_id: uuid.UUID) -> SavingsAccount:
        account = savings_account_repository.get_for_user(db, user_id)
        if account is None:
            account = savings_account_repository.create_for_user(db, user_id)
        return account

    def get_balance(self, db: Session, *, user_id: uuid.UUID) -> int:
        return self._get_account(db, user_id).balance

    def get_account(self, db: Session, *, user_id: uuid.UUID) -> SavingsAccount:
        return self._get_account(db, user_id)

    def credit(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        description: str,
        reference: str | None = None,
        details: dict | None = None,
        type_: TransactionType = TransactionType.FUNDING,
        status: TransactionStatus = TransactionStatus.SUCCESSFUL,
    ) -> Transaction:
        account = self._get_account(db, user_id)
        savings_account_repository.credit(db, account, amount)

        return transaction_repository.create(
            db,
            user_id=user_id,
            type_=type_,
            status=status,
            amount=amount,
            description=description,
            reference=reference or make_reference("TXN"),
            details=details or {"method": "wallet"},
        )

    def debit(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        description: str,
        reference: str | None = None,
        type_: TransactionType = TransactionType.WITHDRAWAL,
        details: dict | None = None,
        track_withdrawal: bool = False,
    ) -> Transaction:
        account = self._get_account(db, user_id)
        if account.balance < amount:
            raise AppException(
                message="Insufficient wallet balance.",
                status_code=400,
                error_code="INSUFFICIENT_FUNDS",
            )

        savings_account_repository.debit(db, account, amount, track_withdrawal=track_withdrawal)

        return transaction_repository.create(
            db,
            user_id=user_id,
            type_=type_,
            status=TransactionStatus.SUCCESSFUL,
            amount=amount,
            description=description,
            reference=reference or make_reference("TXN"),
            details=details or {},
        )

    # ------------------------------------------------------------ reservation

    def reserve(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        description: str,
        reference: str | None = None,
        details: dict | None = None,
    ) -> Transaction:
        """Lock `amount` for a pending withdrawal.

        Available balance drops immediately; `reserved` grows. The returned
        PENDING WITHDRAWAL transaction tracks the reserved funds until it is
        finalised (SUCCESSFUL), released (FAILED) or reverted (REVERTED).
        """
        account = self._get_account(db, user_id)
        if account.balance < amount:
            raise AppException(
                message="Insufficient wallet balance.",
                status_code=400,
                error_code="INSUFFICIENT_FUNDS",
            )

        savings_account_repository.reserve(db, account, amount)

        return transaction_repository.create(
            db,
            user_id=user_id,
            type_=TransactionType.WITHDRAWAL,
            status=TransactionStatus.PENDING,
            amount=amount,
            description=description,
            reference=reference or make_reference("WDL"),
            details=details or {},
        )

    def release_reserved(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        txn_id: uuid.UUID | None = None,
        description: str | None = None,
        details: dict | None = None,
        mark_txn: TransactionStatus = TransactionStatus.FAILED,
    ) -> None:
        """Return reserved funds to the available balance (reject/failure)."""
        account = self._get_account(db, user_id)
        savings_account_repository.release_reserved(db, account, amount)

        if txn_id is not None:
            transaction_repository.update_status(db, txn_id, mark_txn)
            transaction_repository.update_details(db, txn_id, details)

    def finalize_reserved(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        txn_id: uuid.UUID | None = None,
        details: dict | None = None,
    ) -> None:
        """Write off reserved funds after a successful payout.

        `reserved` shrinks and the pending transaction becomes SUCCESSFUL.
        `balance` is untouched — the funds were removed from it at reserve
        time, so the ledger never counts them twice.
        """
        account = self._get_account(db, user_id)
        savings_account_repository.finalize_reserved(db, account, amount)

        if txn_id is not None:
            transaction_repository.update_status(db, txn_id, TransactionStatus.SUCCESSFUL)
            transaction_repository.update_details(db, txn_id, details)

    def revert_withdrawal(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        description: str,
        reference: str | None = None,
        details: dict | None = None,
    ) -> Transaction:
        """Record a reversed transfer and credit funds back to the balance.

        Used when Paystack reports transfer.reversed: the money is returned to
        us, so the user's available balance is restored and a REVERTED
        WITHDRAWAL transaction is recorded.
        """
        account = self._get_account(db, user_id)
        savings_account_repository.credit(db, account, amount)

        return transaction_repository.create(
            db,
            user_id=user_id,
            type_=TransactionType.WITHDRAWAL,
            status=TransactionStatus.REVERTED,
            amount=amount,
            description=description,
            reference=reference or make_reference("WDL"),
            details=details or {},
        )


wallet_service = WalletService()