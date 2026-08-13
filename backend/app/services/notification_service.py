import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.repositories.notification_repository import notification_repository
from app.schemas.notification import NotificationOut


class NotificationService:
    def list_for_user(self, db: Session, *, user: User, page: int = 1, page_size: int = 20):
        items, total = notification_repository.list_for_user(db, user.id, page=page, page_size=page_size)
        unread = notification_repository.unread_count(db, user.id)
        return {
            "items": [NotificationOut.model_validate(item) for item in items],
            "unread_count": unread,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def unread_count(self, db: Session, *, user: User) -> int:
        return notification_repository.unread_count(db, user.id)

    def get_for_user(self, db: Session, *, user: User, notification_id: uuid.UUID) -> NotificationOut:
        notification = db.get(Notification, notification_id)
        if notification is None or notification.user_id != user.id:
            raise AppException(message="Notification not found.", status_code=404, error_code="NOTIFICATION_NOT_FOUND")
        return NotificationOut.model_validate(notification)

    def mark_read(self, db: Session, *, user: User, notification_id: uuid.UUID) -> bool:
        marked = notification_repository.mark_read(db, notification_id, user.id)
        if not marked:
            raise AppException(message="Notification not found.", status_code=404, error_code="NOTIFICATION_NOT_FOUND")
        return True

    def mark_all_read(self, db: Session, *, user: User) -> int:
        return notification_repository.mark_all_read(db, user.id)

    def create(self, db: Session, *, user_id: uuid.UUID, title: str, message: str | None = None, type_: NotificationType = NotificationType.SYSTEM):
        return notification_repository.create(db, user_id=user_id, title=title, message=message, type_=type_)


notification_service = NotificationService()