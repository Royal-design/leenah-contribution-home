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
    record. Paystack (CARD / BANK_TRANSFER) will sit in front of `credit`;
    contribution business logic calls `debit`. Nothing here talks to a payment
    provider.
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
    ) -> Transaction:
        account = self._get_account(db, user_id)
        savings_account_repository.credit(db, account, amount)

        return transaction_repository.create(
            db,
            user_id=user_id,
            type_=TransactionType.FUNDING,
            status=TransactionStatus.SUCCESSFUL,
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


wallet_service = WalletService()
