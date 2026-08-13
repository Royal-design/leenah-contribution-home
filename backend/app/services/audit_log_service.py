from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.audit_log import AuditLog
from app.models.enums import AuditAction, AuditCategory
from app.repositories.audit_log_repository import audit_log_repository
from app.schemas.audit_log import AuditLogList, AuditLogOut, AuditLogRecord


class AuditLogService:
    def record(self, db: Session, entry: AuditLogRecord | dict) -> AuditLog:
        fields = entry.model_dump() if isinstance(entry, AuditLogRecord) else entry
        return audit_log_repository.create(db, **fields)

    def record_from(self, db: Session, actor, *, action: AuditAction, category: AuditCategory, description: str, **extra) -> AuditLog:
        entry = AuditLogRecord(
            action=action,
            category=category,
            description=description,
            actor_id=actor.id if actor else None,
            actor_name=f"{actor.first_name} {actor.last_name}" if actor else None,
            actor_email=actor.email if actor else None,
            actor_role=actor.role if actor else None,
            **extra,
        )
        return self.record(db, entry)

    def get(self, db: Session, entry_id: uuid.UUID) -> AuditLogOut | None:
        entry = audit_log_repository.get(db, entry_id)
        if entry is None:
            return None
        return AuditLogOut.model_validate(entry)

    def list_logs(
        self,
        db: Session,
        *,
        action: AuditAction | None = None,
        category: AuditCategory | None = None,
        search: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AuditLogList:
        if page < 1 or page_size < 1 or page_size > 100:
            raise AppException(message="Invalid pagination parameters.", error_code="INVALID_PAGINATION")

        items, total = audit_log_repository.list_logs(
            db,
            action=action,
            category=category,
            search=search,
            from_date=from_date,
            to_date=to_date,
            page=page,
            page_size=page_size,
        )

        return AuditLogList(
            items=[AuditLogOut.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            pages=(total + page_size - 1) // page_size if total else 0,
        )

    def delete(self, db: Session, *, actor, entry_id: uuid.UUID) -> None:
        entry = audit_log_repository.get(db, entry_id)
        if entry is None:
            raise AppException(message="Audit log entry not found.", status_code=404, error_code="AUDIT_LOG_NOT_FOUND")

        description = f"Deleted audit log entry for '{entry.action.value} / {entry.category.value}'."
        if actor is not None:
            audit_log_repository.create(
                db,
                actor_id=actor.id,
                actor_name=f"{actor.first_name} {actor.last_name}",
                actor_email=actor.email,
                actor_role=actor.role,
                action=AuditAction.DELETE,
                category=AuditCategory.SYSTEM,
                description=description,
                target=entry.description[:120],
                target_id=entry.id,
            )

        db.delete(entry)
        db.flush()


audit_log_service = AuditLogService()