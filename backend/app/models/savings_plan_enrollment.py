from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EnrollmentStatus

if TYPE_CHECKING:
    from app.models.savings_plan import SavingsPlan
    from app.models.user import User


class SavingsPlanEnrollment(Base):
    """A user's membership of an admin-created savings plan."""

    __tablename__ = "savings_plan_enrollments"
    __table_args__ = (UniqueConstraint("plan_id", "user_id", name="uq_savings_plan_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("savings_plans.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    total_saved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_payment_date: Mapped[datetime | None] = mapped_column(DateTime)

    status: Mapped[EnrollmentStatus] = mapped_column(
        SAEnum(EnrollmentStatus), nullable=False, default=EnrollmentStatus.ACTIVE
    )

    joined_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    plan: Mapped["SavingsPlan"] = relationship(back_populates="enrollments")
    user: Mapped["User"] = relationship(back_populates="savings_plan_enrollments")