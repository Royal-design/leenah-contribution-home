import uuid

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.models.enums import SupportStatus
from app.models.support_message import SupportMessage
from app.models.support_thread import SupportThread
from app.models.user import User


class SupportThreadRepository:
    def create(self, db: Session, *, user_id: uuid.UUID, subject: str, category, last_message_at) -> SupportThread:
        thread = SupportThread(
            user_id=user_id,
            subject=subject,
            category=category,
            last_message_at=last_message_at,
        )
        db.add(thread)
        db.flush()
        return thread

    def get(self, db: Session, thread_id: uuid.UUID) -> SupportThread | None:
        return db.execute(
            select(SupportThread)
            .where(SupportThread.id == thread_id)
            .options(selectinload(SupportThread.user))
        ).scalar_one_or_none()

    def list_for_user(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        status: SupportStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SupportThread], int]:
        conditions = [SupportThread.user_id == user_id]
        if status is not None:
            conditions.append(SupportThread.status == status)

        total = db.execute(
            select(func.count(SupportThread.id)).where(*conditions)
        ).scalar_one()
        items = list(
            db.execute(
                select(SupportThread)
                .options(selectinload(SupportThread.user))
                .where(*conditions)
                .order_by(SupportThread.last_message_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            ).scalars().all()
        )
        return items, total

    def list_all(
        self,
        db: Session,
        *,
        status: SupportStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SupportThread], int]:
        conditions = []
        if status is not None:
            conditions.append(SupportThread.status == status)
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    SupportThread.subject.ilike(term),
                    User.email.ilike(term),
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                )
            )

        if conditions:
            base = (
                select(SupportThread)
                .join(SupportThread.user)
                .options(selectinload(SupportThread.user))
                .where(*conditions)
            )
            count_q = (
                select(func.count(SupportThread.id))
                .join(SupportThread.user)
                .where(*conditions)
            )
        else:
            base = select(SupportThread).options(selectinload(SupportThread.user))
            count_q = select(func.count(SupportThread.id))

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(
                base.order_by(SupportThread.last_message_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).scalars().all()
        )
        return items, total

    def set_status(self, db: Session, thread: SupportThread, status: SupportStatus) -> None:
        thread.status = status
        db.flush()

    def touch(self, db: Session, thread: SupportThread, last_message_at) -> None:
        thread.last_message_at = last_message_at
        db.flush()

    def increment_unread(self, db: Session, thread: SupportThread, amount: int = 1) -> None:
        thread.unread_count += amount
        db.flush()

    def clear_unread(self, db: Session, thread: SupportThread) -> None:
        thread.unread_count = 0
        db.flush()

    def total_unread_user(self, db: Session, user_id: uuid.UUID) -> int:
        return db.execute(
            select(func.coalesce(func.sum(SupportThread.unread_count), 0)).where(SupportThread.user_id == user_id)
        ).scalar_one()

    def total_unread_admin(self, db: Session) -> int:
        return db.execute(
            select(func.coalesce(func.sum(SupportThread.unread_count), 0))
        ).scalar_one()


class SupportMessageRepository:
    def create(
        self,
        db: Session,
        *,
        thread_id: uuid.UUID,
        sender_id: uuid.UUID | None,
        sender_role: str,
        sender_name: str,
        body: str,
    ) -> SupportMessage:
        message = SupportMessage(
            thread_id=thread_id,
            sender_id=sender_id,
            sender_role=sender_role,
            sender_name=sender_name,
            body=body,
        )
        db.add(message)
        db.flush()
        return message

    def list_by_thread(self, db: Session, thread_id: uuid.UUID) -> list[SupportMessage]:
        return list(
            db.execute(
                select(SupportMessage).where(SupportMessage.thread_id == thread_id).order_by(SupportMessage.created_at)
            ).scalars().all()
        )

    def mark_read(self, db: Session, thread_id: uuid.UUID, sender_role: str) -> int:
        result = db.execute(
            update(SupportMessage)
            .where(SupportMessage.thread_id == thread_id, SupportMessage.sender_role != sender_role, SupportMessage.is_read.is_(False))
            .values(is_read=True)
        )
        return result.rowcount


support_thread_repository = SupportThreadRepository()
support_message_repository = SupportMessageRepository()