from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import AuditAction, AuditCategory

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    actor_name: Mapped[str | None] = mapped_column(String)
    actor_email: Mapped[str | None] = mapped_column(String)
    actor_role: Mapped[str | None] = mapped_column(String)

    action: Mapped[AuditAction] = mapped_column(SAEnum(AuditAction), nullable=False)
    category: Mapped[AuditCategory] = mapped_column(SAEnum(AuditCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    target: Mapped[str | None] = mapped_column(String)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    details: Mapped[dict | None] = mapped_column(JSONB)

    ip_address: Mapped[str | None] = mapped_column(String)
    user_agent: Mapped[str | None] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    actor: Mapped["User | None"] = relationship(back_populates="audit_logs")