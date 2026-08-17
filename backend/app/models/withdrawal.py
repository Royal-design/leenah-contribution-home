from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import WithdrawalStatus

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.user_bank_account import UserBankAccount


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    withdrawal_type: Mapped[str] = mapped_column(String, nullable=False)  # "savings" | "contribution"

    bank_name: Mapped[str] = mapped_column(String, nullable=False)
    account_number: Mapped[str] = mapped_column(String, nullable=False)
    account_name: Mapped[str | None] = mapped_column(String)
    destination: Mapped[str] = mapped_column(String, nullable=False)

    contribution_name: Mapped[str | None] = mapped_column(String)

    status: Mapped[WithdrawalStatus] = mapped_column(SAEnum(WithdrawalStatus), nullable=False, default=WithdrawalStatus.PENDING)

    requested_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # --- Paystack transfer tracking ---
    bank_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    paystack_recipient_code: Mapped[str | None] = mapped_column(String)
    paystack_transfer_code: Mapped[str | None] = mapped_column(String)
    paystack_reference: Mapped[str | None] = mapped_column(String)

    admin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime)
    failure_reason: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="withdrawals")
    bank_account: Mapped["UserBankAccount | None"] = relationship()