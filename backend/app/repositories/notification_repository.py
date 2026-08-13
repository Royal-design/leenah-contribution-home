import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.enums import NotificationType
from app.models.notification import Notification


class NotificationRepository:
    def create(self, db: Session, *, user_id: uuid.UUID, title: str, message: str | None = None, type_: NotificationType = NotificationType.SYSTEM) -> Notification:
        notification = Notification(user_id=user_id, title=title, message=message, type=type_)
        db.add(notification)
        db.flush()
        return notification

    def list_for_user(self, db: Session, user_id: uuid.UUID, *, page: int = 1, page_size: int = 20) -> tuple[list[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        total = db.execute(select(func.count(Notification.id)).where(Notification.user_id == user_id)).scalar_one()
        items = list(
            db.execute(base.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def unread_count(self, db: Session, user_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count(Notification.id)).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        ).scalar_one()

    def mark_read(self, db: Session, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        result = db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        return result.rowcount > 0

    def mark_all_read(self, db: Session, user_id: uuid.UUID) -> int:
        result = db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        return result.rowcount


notification_repository = NotificationRepository()