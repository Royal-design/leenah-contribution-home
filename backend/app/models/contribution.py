from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ContributionStatus, Frequency

if TYPE_CHECKING:
    from app.models.contribution_member import ContributionMember
    from app.models.contribution_payout import ContributionPayout
    from app.models.contribution_schedule import ContributionSchedule
    from app.models.user import User


class Contribution(Base):
    __tablename__ = "contributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(String)

    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    frequency: Mapped[Frequency] = mapped_column(SAEnum(Frequency), nullable=False)

    member_count: Mapped[int] = mapped_column(Integer, nullable=False)
    rounds: Mapped[int] = mapped_column(Integer, default=12, nullable=False)

    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    withdrawal_date: Mapped[datetime | None] = mapped_column(DateTime)
    next_payment_date: Mapped[datetime | None] = mapped_column(DateTime)
    last_payment_date: Mapped[datetime | None] = mapped_column(DateTime)

    total_contributed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_expected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[ContributionStatus] = mapped_column(SAEnum(ContributionStatus), nullable=False, default=ContributionStatus.UPCOMING)

    withdrawal_rule: Mapped[dict | None] = mapped_column(JSONB)
    is_open: Mapped[bool] = mapped_column(default=True, nullable=False)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    creator: Mapped["User"] = relationship()
    members: Mapped[list["ContributionMember"]] = relationship(back_populates="contribution", cascade="all, delete-orphan")
    schedule: Mapped[list["ContributionSchedule"]] = relationship(back_populates="contribution", cascade="all, delete-orphan")
    payouts: Mapped[list["ContributionPayout"]] = relationship(back_populates="contribution", cascade="all, delete-orphan")