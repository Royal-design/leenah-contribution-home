import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models.dedicated_account import DedicatedAccount
from app.models.enums import AuditAction, AuditCategory, DVStatus, NotificationType
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.dedicated_account_repository import dedicated_account_repository
from app.services.notification_service import notification_service
from app.services.paystack_service import paystack_service


class DVAService:
    """Orchestrates Dedicated Virtual Accounts.

    DVA creation maps User -> Paystack customer -> Paystack DVA -> local
    record. Paystack customer codes are created once and reused. A DVA may be
    created asynchronously (assignment completes via webhook), so a PENDING
    record is stored and reconciled on `dedicatedaccount.assign.success`.
    """

    def ensure_customer(self, db: Session, *, user: User) -> None:
        if user.paystack_customer_code:
            return

        # Paystack requires email, first_name, last_name for NGN customers.
        if not user.email or not user.first_name or not user.last_name:
            raise AppException(
                message="Update your profile (first name, last name and email) before creating a virtual account.",
                status_code=400,
                error_code="CUSTOMER_INFO_REQUIRED",
            )

        data = paystack_service.create_customer(
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
        )
        user.paystack_customer_code = data.get("customer_code")
        user.paystack_customer_id = str(data["id"]) if data.get("id") is not None else None
        db.flush()

    def _customer_info_available(self, user: User) -> bool:
        return bool(user.email and user.first_name and user.last_name and user.phone)

    def get_or_create(self, db: Session, *, user: User) -> DedicatedAccount:
        existing = dedicated_account_repository.get_active_for_user(db, user.id)
        if existing is not None:
            return existing

        if not self._customer_info_available(user):
            raise AppException(
                message="A phone number is required to create your virtual account. Update your profile first.",
                status_code=400,
                error_code="CUSTOMER_INFO_REQUIRED",
            )

        self.ensure_customer(db, user=user)

        dva_data = paystack_service.create_dedicated_account(
            customer_code=user.paystack_customer_code,
            preferred_bank="test-bank" if paystack_service.is_test_mode else None,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            metadata={"lch_user_id": str(user.id), "app": "leenah-contribution-home"},
        )

        dva_id = dva_data.get("id")
        if dva_id is not None:
            dva_id = str(dva_id)

        # Assignment is asynchronous on Paystack's side. Try it now; if it
        # fails (e.g. pending identification), the record stays PENDING and is
        # reconciled by the dedicatedaccount.assign.* webhook.
        try:
            assigned = paystack_service.assign_dedicated_account(
                dedicated_account_id=dva_id,
                customer_code=user.paystack_customer_code,
            )
            for key in ("account_number", "account_name"):
                if assigned.get(key):
                    dva_data[key] = assigned[key]
            if assigned.get("bank"):
                dva_data["bank"] = assigned["bank"]
        except AppException:
            pass

        bank = dva_data.get("bank") or {}
        account = dedicated_account_repository.create(
            db,
            user_id=user.id,
            paystack_customer_code=user.paystack_customer_code,
            paystack_dedicated_account_id=dva_id,
            account_number=dva_data.get("account_number"),
            account_name=dva_data.get("account_name"),
            bank_name=bank.get("name"),
            bank_slug=bank.get("slug"),
            status=DVStatus.PENDING if dva_id else DVStatus.FAILED,
        )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.TRANSACTION,
            description=f"Created a dedicated virtual account for wallet funding.",
            target_id=account.id,
            details={"bank": account.bank_name, "status": account.status.value},
        )

        notification_service.create(
            db,
            user_id=user.id,
            title="Virtual account requested",
            message="Your wallet virtual account is being set up. You'll get your account details shortly.",
            type_=NotificationType.SAVINGS,
        )
        return account

    def get_mine(self, db: Session, *, user: User) -> DedicatedAccount | None:
        return dedicated_account_repository.get_for_user(db, user.id)

    def requery(self, db: Session, *, user: User) -> DedicatedAccount:
        account = dedicated_account_repository.get_for_user(db, user.id)
        if account is None:
            raise AppException(
                message="No virtual account found. Create one first.",
                status_code=404,
                error_code="DVA_NOT_FOUND",
            )

        now = datetime.now(timezone.utc)
        if account.last_requeried_at is not None:
            elapsed = now - (account.last_requeried_at.replace(tzinfo=timezone.utc) if account.last_requeried_at.tzinfo is None else account.last_requeried_at)
            if elapsed.total_seconds() < settings.paystack_requery_cooldown_seconds:
                remaining = int(settings.paystack_requery_cooldown_seconds - elapsed.total_seconds())
                raise AppException(
                    message=f"Please wait {remaining}s before checking again.",
                    status_code=429,
                    error_code="DVA_REQUERY_COOLDOWN",
                )

        if not account.account_number:
            raise AppException(
                message="This virtual account has no account number yet.",
                status_code=400,
                error_code="DVA_NOT_READY",
            )

        data = paystack_service.requery_dedicated_account(
            account_number=account.account_number,
            provider_slug=account.bank_slug,
        )
        account.last_requeried_at = now

        if data:
            status = (data.get("status") or "").lower()
            mapping = {"assigned": DVStatus.ACTIVE, "active": DVStatus.ACTIVE, "pending": DVStatus.PENDING}
            if status in mapping:
                account.status = mapping[status]
            bank = data.get("bank") or {}
            if bank.get("name"):
                account.bank_name = bank.get("name")
            if bank.get("slug"):
                account.bank_slug = bank.get("slug")
            if data.get("account_name"):
                account.account_name = data.get("account_name")
            if data.get("account_number"):
                account.account_number = data.get("account_number")
        db.flush()
        return account


dva_service = DVAService()