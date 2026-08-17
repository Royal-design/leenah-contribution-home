import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.user import User
from app.models.user_bank_account import UserBankAccount
from app.repositories.bank_account_repository import user_bank_account_repository
from app.services.paystack_service import paystack_service


def mask_account(number: str) -> str:
    return f"****{number[-4:]}"


class BankAccountService:
    def _own(self, db: Session, user_id: uuid.UUID, account_id: uuid.UUID) -> UserBankAccount:
        account = user_bank_account_repository.get(db, account_id)
        if account is None or account.user_id != user_id:
            raise AppException(message="Bank account not found.", status_code=404, error_code="BANK_ACCOUNT_NOT_FOUND")
        return account

    def list_mine(self, db: Session, *, user: User) -> list[UserBankAccount]:
        return user_bank_account_repository.get_for_user(db, user.id)

    def list_banks(self) -> dict:
        """Banks are resolved from Paystack; responses include the code + slug."""
        data = paystack_service.list_banks()
        banks = data if isinstance(data, list) else data.get("data", []) if isinstance(data, dict) else []
        return {"banks": [{"name": b.get("name"), "code": b.get("code"), "slug": b.get("slug"), "longcode": b.get("longcode")} for b in banks]}

    def resolve(self, *, account_number: str, bank_code: str) -> dict:
        if not bank_code:
            raise AppException(
                message="A bank code is required to verify an account.",
                status_code=400,
                error_code="BANK_CODE_REQUIRED",
            )
        data = paystack_service.resolve_bank(account_number=account_number, bank_code=bank_code)
        return {
            "account_number": account_number,
            "bank_code": bank_code,
            "bank_name": data.get("bank_name") or "",
            "account_name": data.get("account_name") or "",
            "verified": True,
            "masked_account_number": mask_account(account_number),
        }

    def _ensure_recipient(self, *, bank_code: str, account_number: str, account_name: str) -> str:
        data = paystack_service.create_transfer_recipient(
            name=account_name,
            account_number=account_number,
            bank_code=bank_code,
        )
        recipient_code = data.get("recipient_code")
        if not recipient_code:
            raise AppException(
                message="Could not create a transfer recipient.",
                status_code=502,
                error_code="PAYSTACK_ERROR",
            )
        return recipient_code

    def create(
        self,
        db: Session,
        *,
        user: User,
        bank_code: str | None,
        bank_name: str | None,
        account_number: str,
        account_name: str | None,
        is_default: bool,
    ) -> UserBankAccount:
        # Never trust frontend account names: resolve server-side and only save
        # the account as verified when Paystack confirms it.
        resolved = self.resolve(account_number=account_number, bank_code=bank_code or "")
        verified_name = resolved["account_name"]
        resolved_bank_name = resolved["bank_name"] or bank_name or ""

        recipient_code = self._ensure_recipient(
            bank_code=bank_code or "",
            account_number=account_number,
            account_name=verified_name,
        )

        accounts = user_bank_account_repository.get_for_user(db, user.id)
        is_default = is_default or not accounts
        return user_bank_account_repository.create(
            db,
            user_id=user.id,
            bank_code=bank_code,
            bank_name=resolved_bank_name,
            account_number=account_number,
            account_name=verified_name,
            is_default=is_default,
            is_verified=True,
            provider_recipient_code=recipient_code,
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

        sensitive = {"account_number", "bank_code"}
        for key in sensitive:
            value = fields.get(key)
            if value is not None and value != getattr(account, key, None):
                raise AppException(
                    message="Re-verify and re-add the account to change its details.",
                    status_code=400,
                    error_code="REQUIRES_REVERIFY",
                )

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