import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.realtime import broadcast
from app.models.enums import NotificationType
from app.models.notification import Notification
from app.models.user import User
from app.repositories.notification_repository import notification_repository
from app.repositories.user_repository import user_repository
from app.schemas.notification import NotificationOut


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _emit(user_id: uuid.UUID, notification: Notification) -> None:
    broadcast(f"user:{user_id}", {
        "type": "notification",
        "notification": {
            "id": str(notification.id),
            "type": notification.type.value,
            "title": notification.title,
            "message": notification.message,
            "is_read": notification.is_read,
            "created_at": _as_utc(notification.created_at).isoformat(),
        },
    })


def _emit_admin(title: str, message: str | None, type_: NotificationType) -> None:
    broadcast("admin", {
        "type": "notification",
        "notification": {
            "type": type_.value,
            "title": title,
            "message": message,
        },
    })


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
        notification = notification_repository.create(db, user_id=user_id, title=title, message=message, type_=type_)
        _emit(user_id, notification)
        return notification

    def notify_admins(self, db: Session, *, title: str, message: str | None = None, type_: NotificationType = NotificationType.SYSTEM) -> int:
        """Notify every active admin about something (support message, withdrawal request, ...)."""
        admins = user_repository.list_admins(db)
        for admin in admins:
            notification_repository.create(db, user_id=admin.id, title=title, message=message, type_=type_)
        _emit_admin(title, message, type_)
        return len(admins)

    def notify_all_users(self, db: Session, *, title: str, message: str | None = None, type_: NotificationType = NotificationType.SYSTEM, exclude_user_id: uuid.UUID | None = None) -> int:
        """Platform-wide announcement persisted to every active user (e.g. a new plan)."""
        users = user_repository.list_active(db)
        recipients = 0
        for target in users:
            if exclude_user_id is not None and target.id == exclude_user_id:
                continue
            notification_repository.create(db, user_id=target.id, title=title, message=message, type_=type_)
            recipients += 1
        broadcast("all_users", {
            "type": "notification",
            "notification": {"type": type_.value, "title": title, "message": message},
        })
        return recipients


notification_service = NotificationService()