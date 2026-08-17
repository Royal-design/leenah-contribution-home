import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user_bank_account import UserBankAccount


class UserBankAccountRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        bank_code: str | None,
        bank_name: str,
        account_number: str,
        account_name: str | None,
        is_default: bool = False,
        is_verified: bool = False,
        provider_recipient_code: str | None = None,
    ) -> UserBankAccount:
        if is_default:
            self.clear_default(db, user_id)
        account = UserBankAccount(
            user_id=user_id,
            bank_code=bank_code,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            is_default=is_default,
            is_verified=is_verified,
            provider_recipient_code=provider_recipient_code,
        )
        db.add(account)
        db.flush()
        return account

    def get(self, db: Session, account_id: uuid.UUID) -> UserBankAccount | None:
        return db.get(UserBankAccount, account_id)

    def get_for_user(self, db: Session, user_id: uuid.UUID) -> list[UserBankAccount]:
        return list(
            db.execute(
                select(UserBankAccount)
                .where(UserBankAccount.user_id == user_id)
                .order_by(UserBankAccount.is_default.desc(), UserBankAccount.created_at.desc())
            ).scalars().all()
        )

    def clear_default(self, db: Session, user_id: uuid.UUID) -> None:
        db.execute(
            UserBankAccount.__table__.update()
            .where(UserBankAccount.user_id == user_id)
            .values(is_default=False)
        )

    def set_default(self, db: Session, account: UserBankAccount) -> None:
        self.clear_default(db, account.user_id)
        account.is_default = True
        db.flush()

    def delete(self, db: Session, account: UserBankAccount) -> None:
        db.delete(account)
        db.flush()


user_bank_account_repository = UserBankAccountRepository()