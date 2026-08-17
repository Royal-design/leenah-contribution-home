from datetime import datetime, timezone
import uuid

from sqlalchemy import DateTime, Enum as SAEnum, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import WebhookEventStatus


class WebhookEvent(Base):
    """Idempotency ledger for incoming provider webhooks.

    Every webhook event is claimed here first (unique event_id) before any
    financial side-effect runs. Duplicate deliveries are detected and dropped
    so a payment is never processed twice.
    """

    __tablename__ = "webhook_events"
    __table_args__ = (UniqueConstraint("event_id", name="uq_webhook_events_event_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    provider: Mapped[str] = mapped_column(String, default="paystack", nullable=False)
    event_id: Mapped[str] = mapped_column(String, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    reference: Mapped[str | None] = mapped_column(String, index=True)
    payload_hash: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[WebhookEventStatus] = mapped_column(SAEnum(WebhookEventStatus), nullable=False, default=WebhookEventStatus.RECEIVED)
    details: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime)