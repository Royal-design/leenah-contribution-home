import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import WebhookEventStatus
from app.models.webhook_event import WebhookEvent


class WebhookEventRepository:
    def create(
        self,
        db: Session,
        *,
        provider: str,
        event_id: str,
        event_type: str,
        payload_hash: str,
        reference: str | None = None,
        details: dict | None = None,
    ) -> WebhookEvent:
        event = WebhookEvent(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            payload_hash=payload_hash,
            reference=reference,
            details=details,
        )
        db.add(event)
        db.flush()
        return event

    def get_by_event_id(self, db: Session, event_id: str) -> WebhookEvent | None:
        return db.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        ).scalar_one_or_none()

    def mark_processed(self, db: Session, event: WebhookEvent) -> None:
        from datetime import datetime, timezone

        event.status = WebhookEventStatus.PROCESSED
        event.processed_at = datetime.now(timezone.utc)
        db.flush()

    def mark_failed(self, db: Session, event: WebhookEvent, reason: str | None = None) -> None:
        event.status = WebhookEventStatus.FAILED
        event.details = {"failure": reason}
        db.flush()


webhook_event_repository = WebhookEventRepository()