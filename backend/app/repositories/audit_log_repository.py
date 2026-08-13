from datetime import datetime
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.enums import AuditAction, AuditCategory


class AuditLogRepository:
    def create(self, db: Session, **fields) -> AuditLog:
        entry = AuditLog(**fields)
        db.add(entry)
        db.flush()
        return entry

    def get(self, db: Session, entry_id: uuid.UUID) -> AuditLog | None:
        return db.get(AuditLog, entry_id)

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
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)

        conditions = []
        if action is not None:
            conditions.append(AuditLog.action == action)
        if category is not None:
            conditions.append(AuditLog.category == category)
        if from_date is not None:
            conditions.append(AuditLog.created_at >= from_date)
        if to_date is not None:
            conditions.append(AuditLog.created_at <= to_date)
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    AuditLog.actor_name.ilike(term),
                    AuditLog.actor_email.ilike(term),
                    AuditLog.description.ilike(term),
                    AuditLog.target.ilike(term),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))

        total = db.execute(
            select(func.count(AuditLog.id)).where(and_(*conditions)) if conditions else select(func.count(AuditLog.id))
        ).scalar_one()

        query = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        items = list(db.execute(query).scalars().all())
        return items, total


audit_log_repository = AuditLogRepository()