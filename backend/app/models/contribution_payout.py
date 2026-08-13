from datetime import datetime
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer
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

    contribution: Mapped["Contribution"] = relationship()
    transaction: Mapped["Transaction | None"] = relationship()