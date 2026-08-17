from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PaymentProvider, PaymentPurpose, PaymentStatus

if TYPE_CHECKING:
    from app.models.user import User


class Payment(Base):
    """A provider-level payment record.

    Distinct from the internal `Transaction` ledger: this table describes the
    interaction with the external payment provider (Paystack). The wallet
    ledger entry is created separately by WalletService once a payment is
    confirmed.
    """

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("internal_reference", name="uq_payments_internal_reference"),
        UniqueConstraint("provider_reference", name="uq_payments_provider_reference"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="NGN", nullable=False)

    provider: Mapped[PaymentProvider] = mapped_column(SAEnum(PaymentProvider), nullable=False, default=PaymentProvider.PAYSTACK)
    provider_reference: Mapped[str | None] = mapped_column(String)
    internal_reference: Mapped[str] = mapped_column(String, nullable=False)

    payment_method: Mapped[str] = mapped_column(String, default="card", nullable=False)
    purpose: Mapped[PaymentPurpose] = mapped_column(SAEnum(PaymentPurpose), nullable=False, default=PaymentPurpose.WALLET_FUNDING)
    status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)

    details: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="payments")