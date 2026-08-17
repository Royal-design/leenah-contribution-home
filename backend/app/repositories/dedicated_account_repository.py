import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dedicated_account import DedicatedAccount
from app.models.enums import DVStatus


class DedicatedAccountRepository:
    def create(self, db: Session, *, user_id: uuid.UUID, **fields) -> DedicatedAccount:
        account = DedicatedAccount(user_id=user_id, **fields)
        db.add(account)
        db.flush()
        return account

    def get(self, db: Session, account_id: uuid.UUID) -> DedicatedAccount | None:
        return db.get(DedicatedAccount, account_id)

    def get_for_user(self, db: Session, user_id: uuid.UUID) -> DedicatedAccount | None:
        return db.execute(
            select(DedicatedAccount)
            .where(DedicatedAccount.user_id == user_id)
            .order_by(DedicatedAccount.created_at.desc())
        ).scalars().first()

    def get_active_for_user(self, db: Session, user_id: uuid.UUID) -> DedicatedAccount | None:
        return db.execute(
            select(DedicatedAccount)
            .where(
                DedicatedAccount.user_id == user_id,
                DedicatedAccount.status.in_([DVStatus.ACTIVE, DVStatus.PENDING]),
            )
            .order_by(DedicatedAccount.created_at.desc())
        ).scalars().first()

    def get_by_account_number(self, db: Session, account_number: str) -> DedicatedAccount | None:
        return db.execute(
            select(DedicatedAccount).where(DedicatedAccount.account_number == account_number)
        ).scalar_one_or_none()

    def get_by_customer_code(self, db: Session, customer_code: str) -> DedicatedAccount | None:
        return db.execute(
            select(DedicatedAccount)
            .where(DedicatedAccount.paystack_customer_code == customer_code)
            .order_by(DedicatedAccount.created_at.desc())
        ).scalars().first()

    def set_status(self, db: Session, account: DedicatedAccount, status: DVStatus) -> None:
        account.status = status
        db.flush()


dedicated_account_repository = DedicatedAccountRepository()