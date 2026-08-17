from datetime import datetime, timezone
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import DVStatus


class DedicatedAccount(Base):
    """A Paystack Dedicated Virtual Account assigned to a user.

    The DVA is a receiving bank account used to fund the wallet via bank
    transfer. `assigning` a DVA is asynchronous on Paystack's side, so a
    PENDING record is stored first and status is reconciled via webhooks
    (dedicatedaccount.assign.success / failed) or requery.
    """

    __tablename__ = "dedicated_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    paystack_customer_code: Mapped[str] = mapped_column(String, nullable=False)
    paystack_dedicated_account_id: Mapped[str | None] = mapped_column(String)
    account_number: Mapped[str | None] = mapped_column(String)
    account_name: Mapped[str | None] = mapped_column(String)
    bank_name: Mapped[str | None] = mapped_column(String)
    bank_slug: Mapped[str | None] = mapped_column(String)
    currency: Mapped[str] = mapped_column(String, default="NGN", nullable=False)
    provider: Mapped[str] = mapped_column(String, default="paystack", nullable=False)
    status: Mapped[DVStatus] = mapped_column(SAEnum(DVStatus), nullable=False, default=DVStatus.PENDING)

    last_requeried_at: Mapped[datetime | None] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


Index("ix_dedicated_accounts_account_number", DedicatedAccount.account_number, unique=True)