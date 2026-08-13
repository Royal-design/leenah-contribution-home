import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.user import User
from app.models.user_bank_account import UserBankAccount
from app.repositories.bank_account_repository import user_bank_account_repository


class BankAccountService:
    def _own(self, db: Session, user_id: uuid.UUID, account_id: uuid.UUID) -> UserBankAccount:
        account = user_bank_account_repository.get(db, account_id)
        if account is None or account.user_id != user_id:
            raise AppException(message="Bank account not found.", status_code=404, error_code="BANK_ACCOUNT_NOT_FOUND")
        return account

    def list_mine(self, db: Session, *, user: User) -> list[UserBankAccount]:
        return user_bank_account_repository.get_for_user(db, user.id)

    def create(
        self,
        db: Session,
        *,
        user: User,
        bank_code: str | None,
        bank_name: str,
        account_number: str,
        account_name: str | None,
        is_default: bool,
    ) -> UserBankAccount:
        accounts = user_bank_account_repository.get_for_user(db, user.id)
        is_default = is_default or not accounts
        return user_bank_account_repository.create(
            db,
            user_id=user.id,
            bank_code=bank_code,
            bank_name=bank_name,
            account_number=account_number,
            account_name=account_name,
            is_default=is_default,
        )

    def update(
        self,
        db: Session,
        *,
        user: User,
        account_id: uuid.UUID,
        **fields,
    ) -> UserBankAccount:
        account = self._own(db, user.id, account_id)
        for key, value in fields.items():
            if value is not None:
                setattr(account, key, value)
        db.flush()
        return account

    def set_default(self, db: Session, *, user: User, account_id: uuid.UUID) -> UserBankAccount:
        account = self._own(db, user.id, account_id)
        user_bank_account_repository.set_default(db, account)
        return account

    def delete(self, db: Session, *, user: User, account_id: uuid.UUID) -> None:
        account = self._own(db, user.id, account_id)
        user_bank_account_repository.delete(db, account)


bank_account_service = BankAccountService()