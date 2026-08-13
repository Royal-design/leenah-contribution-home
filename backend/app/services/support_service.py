from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory, NotificationType, SupportStatus
from app.models.support_thread import SupportThread
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.support_repository import (
    support_message_repository,
    support_thread_repository,
)
from app.schemas.support import SupportMessageOut, SupportThreadDetail, SupportThreadOut
from app.services.notification_service import notification_service


def _sender_role(user: User) -> str:
    return "admin" if user.is_admin else "user"


def _thread_to_out(thread: SupportThread) -> SupportThreadOut:
    user = thread.user
    return SupportThreadOut(
        id=thread.id,
        user_id=thread.user_id,
        user_name=f"{user.first_name} {user.last_name}".strip() if user else None,
        user_email=user.email if user else None,
        subject=thread.subject,
        category=thread.category,
        status=thread.status,
        unread_count=thread.unread_count,
        last_message_at=thread.last_message_at,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


class SupportService:
    def _can_access(self, db: Session, *, user: User, thread_id: uuid.UUID) -> SupportThread:
        thread = support_thread_repository.get(db, thread_id)
        if thread is None:
            raise AppException(message="Thread not found.", status_code=404, error_code="THREAD_NOT_FOUND")
        is_admin = user.is_admin
        if not is_admin and thread.user_id != user.id:
            raise AppException(message="Thread not found.", status_code=404, error_code="THREAD_NOT_FOUND")
        return thread

    def create_thread(self, db: Session, *, user: User, subject: str, category, message: str) -> SupportThreadDetail:
        now = datetime.now(timezone.utc)
        thread = support_thread_repository.create(
            db,
            user_id=user.id,
            subject=subject,
            category=category,
            last_message_at=now,
        )
        support_message_repository.create(
            db,
            thread_id=thread.id,
            sender_id=user.id,
            sender_role=_sender_role(user),
            sender_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            body=message,
        )
        support_thread_repository.increment_unread(db, thread)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.SYSTEM,
            description=f"Opened support thread '{subject}'.",
            target=subject,
            target_id=thread.id,
        )

        notification_service.notify_admins(
            db,
            title="New support message",
            message=f"{user.first_name} {user.last_name} wrote: {subject}",
            type_=NotificationType.SYSTEM,
        )

        return self.get_thread(db, user=user, thread_id=thread.id)

    def list_threads(
        self,
        db: Session,
        *,
        user: User,
        status: SupportStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        if user.is_admin:
            items, total = support_thread_repository.list_all(
                db, status=status, search=search, page=page, page_size=page_size
            )
        else:
            items, total = support_thread_repository.list_for_user(
                db, user.id, status=status, page=page, page_size=page_size
            )

        return {
            "items": [_thread_to_out(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def get_thread(self, db: Session, *, user: User, thread_id: uuid.UUID) -> SupportThreadDetail:
        thread = self._can_access(db, user=user, thread_id=thread_id)
        role = _sender_role(user)

        support_message_repository.mark_read(db, thread_id, role)
        support_thread_repository.clear_unread(db, thread)
        db.flush()

        messages = support_message_repository.list_by_thread(db, thread_id)

        return SupportThreadDetail(
            **_thread_to_out(thread).model_dump(),
            messages=[SupportMessageOut.model_validate(m) for m in messages],
        )

    def reply(self, db: Session, *, user: User, thread_id: uuid.UUID, body: str) -> SupportThreadDetail:
        thread = self._can_access(db, user=user, thread_id=thread_id)
        if thread.status == SupportStatus.RESOLVED:
            raise AppException(
                message="This thread is closed. Open a new thread to continue the conversation.",
                status_code=400,
                error_code="THREAD_RESOLVED",
            )

        role = _sender_role(user)
        support_message_repository.create(
            db,
            thread_id=thread.id,
            sender_id=user.id,
            sender_role=role,
            sender_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            body=body,
        )

        now = datetime.now(timezone.utc)
        support_thread_repository.touch(db, thread, now)
        support_thread_repository.increment_unread(db, thread)

        # Status flips depending on who last replied.
        new_status = SupportStatus.REPLIED if role == "admin" else SupportStatus.OPEN
        support_thread_repository.set_status(db, thread, new_status)

        if role == "admin":
            notification_service.create(
                db,
                user_id=thread.user_id,
                title="Reply from the LCH team",
                message=f"Your conversation '{thread.subject}' has a new reply.",
                type_=NotificationType.SYSTEM,
            )
        else:
            notification_service.notify_admins(
                db,
                title="New support reply",
                message=f"{user.first_name} {user.last_name} replied on '{thread.subject}'.",
                type_=NotificationType.SYSTEM,
            )

        return self.get_thread(db, user=user, thread_id=thread_id)

    def set_status(self, db: Session, *, user: User, thread_id: uuid.UUID, status: SupportStatus) -> SupportThreadOut:
        thread = self._can_access(db, user=user, thread_id=thread_id)
        support_thread_repository.set_status(db, thread, status)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SYSTEM,
            description=f"Set support thread '{thread.subject}' to {status.value}.",
            target=thread.subject,
            target_id=thread.id,
        )
        return _thread_to_out(thread)

    def unread_count(self, db: Session, *, user: User) -> int:
        if user.is_admin:
            return support_thread_repository.total_unread_admin(db)
        return support_thread_repository.total_unread_user(db, user.id)


support_service = SupportService()