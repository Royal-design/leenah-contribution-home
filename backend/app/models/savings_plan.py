from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import Frequency, SavingsPlanStatus

if TYPE_CHECKING:
    from app.models.savings_plan_enrollment import SavingsPlanEnrollment
    from app.models.savings_plan_schedule import SavingsPlanSchedule
    from app.models.user import User


class SavingsPlan(Base):
    """An admin-created savings plan that users can join.

    Users do not create these. Admins configure a duration (in calendar
    months) and the system derives the end date. Members pay a per-period
    amount (from their wallet) and track progress via their own schedule.
    """

    __tablename__ = "savings_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    organization: Mapped[str | None] = mapped_column(String)

    # Per-period contribution amount each member pays.
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # Optional overall funding target (informational, not enforced).
    target_amount: Mapped[int | None] = mapped_column(Integer)
    frequency: Mapped[Frequency] = mapped_column(SAEnum(Frequency), nullable=False)

    # Duration in whole calendar months (used to derive end_date).
    duration_months: Mapped[int | None] = mapped_column(Integer)

    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime)
    next_payment_date: Mapped[datetime | None] = mapped_column(DateTime)
    last_payment_date: Mapped[datetime | None] = mapped_column(DateTime)

    # Number of scheduled payments per member, derived from start/end/frequency.
    rounds: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    total_saved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_expected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[SavingsPlanStatus] = mapped_column(
        SAEnum(SavingsPlanStatus), nullable=False, default=SavingsPlanStatus.UPCOMING
    )
    is_open: Mapped[bool] = mapped_column(default=True, nullable=False)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    creator: Mapped["User"] = relationship()
    enrollments: Mapped[list["SavingsPlanEnrollment"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    schedule: Mapped[list["SavingsPlanSchedule"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )