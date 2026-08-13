from datetime import datetime
from typing import TYPE_CHECKING
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ScheduleStatus

if TYPE_CHECKING:
    from app.models.contribution import Contribution
    from app.models.contribution_member import ContributionMember
    from app.models.transaction import Transaction


class ContributionSchedule(Base):
    __tablename__ = "contribution_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    contribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contributions.id", ondelete="CASCADE"),
        nullable=False,
    )

    member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contribution_members.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    period: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str | None] = mapped_column(String)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[ScheduleStatus] = mapped_column(SAEnum(ScheduleStatus), nullable=False, default=ScheduleStatus.UPCOMING)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)

    paid_at: Mapped[datetime | None] = mapped_column(DateTime)
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String)

    contribution: Mapped["Contribution"] = relationship(back_populates="schedule")
    member: Mapped["ContributionMember | None"] = relationship()
    transaction: Mapped["Transaction | None"] = relationship()