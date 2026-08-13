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


class ContributionSchedule(Base):
    __tablename__ = "contribution_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    contribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contributions.id", ondelete="CASCADE"),
        nullable=False,
    )

    period: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str | None] = mapped_column(String)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[ScheduleStatus] = mapped_column(SAEnum(ScheduleStatus), nullable=False, default=ScheduleStatus.UPCOMING)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)

    contribution: Mapped["Contribution"] = relationship(back_populates="schedule")