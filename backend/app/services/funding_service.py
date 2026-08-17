import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models.enums import PaymentProvider, PaymentPurpose, PaymentStatus
from app.models.payment import Payment
from app.models.user import User
from app.repositories.payment_repository import payment_repository
from app.services.paystack_service import paystack_service
from app.services.webhook_service import webhook_service
from app.services.wallet_service import make_reference


class FundingService:
    """Card wallet funding via the Paystack checkout flow.

    The frontend only ever receives the authorization URL. The authoritative
    confirmation is the Paystack webhook (charge.success); the verify endpoint
    below is a convenient server-side fallback that runs the exact same
    idempotent processing path.
    """

    def initialize_card(self, db: Session, *, user: User, amount: int, callback_url: str | None = None) -> dict:
        internal_reference = make_reference("PYM")
        payment = payment_repository.create(
            db,
            user_id=user.id,
            amount=amount,
            internal_reference=internal_reference,
            provider=PaymentProvider.PAYSTACK,
            provider_reference=internal_reference,
            payment_method="card",
            purpose=PaymentPurpose.WALLET_FUNDING,
            status=PaymentStatus.PENDING,
            details={"source": "card_checkout"},
        )

        data = paystack_service.initialize_transaction(
            email=user.email,
            amount=amount * 100,  # kobo
            reference=internal_reference,
            callback_url=callback_url or f"{settings.frontend_url.rstrip('/')}/wallet",
            metadata={"lch_user_id": str(user.id), "payment_id": str(payment.id)},
        )

        return {
            "authorization_url": data.get("authorization_url"),
            "reference": internal_reference,
            "access_code": data.get("access_code"),
        }

    def verify_card(self, db: Session, *, user: User, reference: str) -> tuple[Payment, bool]:
        payment = payment_repository.get_by_internal_reference(db, reference) or payment_repository.get_by_provider_reference(db, reference)
        if payment is None:
            raise AppException(message="Payment reference not found.", status_code=404, error_code="PAYMENT_NOT_FOUND")
        if payment.user_id != user.id:
            raise AppException(message="Payment reference not found.", status_code=404, error_code="PAYMENT_NOT_FOUND")

        verified = paystack_service.verify_transaction(reference)

        if (verified.get("status") or "").lower() == "success":
            outcome = webhook_service._process_charge_success(db, verified)
            return payment, outcome in ("credited", "already_processed", "already_credited")

        if payment.status == PaymentStatus.PENDING:
            payment_repository.set_status(db, payment, PaymentStatus.FAILED)
        return payment, False


funding_service = FundingService()