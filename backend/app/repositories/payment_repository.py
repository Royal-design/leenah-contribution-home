import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import PaymentStatus
from app.models.payment import Payment


class PaymentRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        amount: int,
        internal_reference: str,
        purpose,
        currency: str = "NGN",
        provider=None,
        provider_reference: str | None = None,
        payment_method: str = "card",
        status: PaymentStatus = PaymentStatus.PENDING,
        details: dict | None = None,
    ) -> Payment:
        payment = Payment(
            user_id=user_id,
            amount=amount,
            currency=currency,
            provider=provider,
            provider_reference=provider_reference,
            internal_reference=internal_reference,
            payment_method=payment_method,
            purpose=purpose,
            status=status,
            details=details,
        )
        db.add(payment)
        db.flush()
        return payment

    def get(self, db: Session, payment_id: uuid.UUID) -> Payment | None:
        return db.get(Payment, payment_id)

    def get_by_internal_reference(self, db: Session, reference: str) -> Payment | None:
        return db.execute(
            select(Payment).where(Payment.internal_reference == reference)
        ).scalar_one_or_none()

    def get_by_provider_reference(self, db: Session, reference: str) -> Payment | None:
        return db.execute(
            select(Payment).where(Payment.provider_reference == reference)
        ).scalar_one_or_none()

    def set_status(self, db: Session, payment: Payment, status: PaymentStatus) -> None:
        payment.status = status
        db.flush()


payment_repository = PaymentRepository()