from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PayoutStatus

if TYPE_CHECKING:
    from app.models.contribution import Contribution
    from app.models.transaction import Transaction


class ContributionPayout(Base):
    """A single payout a member is scheduled to receive from a contribution.

    Distinct from ContributionSchedule (contributions flowing IN) — payouts
    represent money flowing OUT to a member (rotational/esusu model).

    Payouts go through admin approval: when a round completes the payout is
    marked eligible (`eligible_at`), and an admin must approve it before the
    money is credited to the member's wallet. Commission, if configured, is
    deducted from the payout.
    """

    __tablename__ = "contribution_payouts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    contribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contributions.id", ondelete="CASCADE"),
        nullable=False,
    )

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contribution_members.id", ondelete="CASCADE"),
        nullable=False,
    )

    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    scheduled_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PayoutStatus] = mapped_column(SAEnum(PayoutStatus), nullable=False, default=PayoutStatus.PENDING)

    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # --- admin approval lifecycle ---
    eligible_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    admin_note: Mapped[str | None] = mapped_column(Text)

    # --- commission (frozen at payout time) ---
    gross_amount: Mapped[int | None] = mapped_column(Integer)
    commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    commission_type: Mapped[str | None] = mapped_column(String)
    commission_amount: Mapped[int | None] = mapped_column(Integer)
    net_amount: Mapped[int | None] = mapped_column(Integer)

    contribution: Mapped["Contribution"] = relationship()
    transaction: Mapped["Transaction | None"] = relationship()