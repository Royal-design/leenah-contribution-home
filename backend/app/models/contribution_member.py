from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contribution import Contribution
    from app.models.user import User


class ContributionMember(Base):
    __tablename__ = "contribution_members"
    __table_args__ = (UniqueConstraint("contribution_id", "user_id", name="uq_contribution_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    contribution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contributions.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    display_name: Mapped[str] = mapped_column(String, nullable=False)
    avatar: Mapped[str | None] = mapped_column(String)

    position: Mapped[int] = mapped_column(Integer, nullable=False)
    total_contributed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    joined_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    contribution: Mapped["Contribution"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")