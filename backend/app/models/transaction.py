from datetime import datetime, timezone
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import TransactionStatus, TransactionType

if TYPE_CHECKING:
    from app.models.contribution import Contribution
    from app.models.savings_plan import SavingsPlan
    from app.models.user import User
    from app.models.withdrawal import Withdrawal


class Transaction(Base):
    """The authoritative money ledger.

    Every movement of money writes a row here. `amount` is the *net* amount
    actually moved for the user (what was credited or debited). When a
    commission/fee applies the gross/commission columns expose the full
    breakdown so the ledger is always reconcilable:

        gross_amount - commission_amount - fee_amount = net_amount = amount

    Related entities (plan / contribution / withdrawal) are stored in
    dedicated columns so the ledger can be traced without parsing JSON.
    """

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    type: Mapped[TransactionType] = mapped_column(SAEnum(TransactionType), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(SAEnum(TransactionStatus), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    reference: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB)

    # --- financial precision / commission breakdown ---
    currency: Mapped[str] = mapped_column(String, default="NGN", nullable=False)
    source: Mapped[str | None] = mapped_column(String)  # wallet/plan/contribution/emergency/admin/webhook
    gross_amount: Mapped[int | None] = mapped_column(Integer)
    commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    commission_type: Mapped[str | None] = mapped_column(String)  # percentage | fixed | percentage_fixed
    commission_amount: Mapped[int | None] = mapped_column(Integer)
    fee_amount: Mapped[int | None] = mapped_column(Integer)
    net_amount: Mapped[int | None] = mapped_column(Integer)

    # --- related entities ---
    related_savings_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("savings_plans.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_contribution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contributions.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_withdrawal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("withdrawals.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_emergency_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # --- lifecycle / approval ---
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime)
    failure_reason: Mapped[str | None] = mapped_column(Text)

    date: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user: Mapped["User"] = relationship(back_populates="transactions")