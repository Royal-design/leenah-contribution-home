from datetime import datetime
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.enums import UserRole, UserStatus
from app.models.user import User


class UserRepository:
    def create(self, db: Session, *, first_name, last_name, email, password, phone=None, provider="credentials", role=None, roles=None) -> User:
        role = role or UserRole.USER
        if roles is None:
            roles = [UserRole.ADMIN, UserRole.USER] if role == UserRole.ADMIN else [UserRole.USER]
        user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=password,
            phone=phone,
            provider=provider,
            role=role,
            roles=roles,
        )
        db.add(user)
        db.flush()
        return user

    def get(self, db: Session, user_id: uuid.UUID) -> User | None:
        return db.get(User, user_id)

    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    def list_users(
        self,
        db: Session,
        *,
        search: str | None = None,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[User], int]:
        conditions = []
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.first_name.ilike(term),
                    User.last_name.ilike(term),
                    User.email.ilike(term),
                )
            )
        if role is not None:
            conditions.append(User.role == role)
        if status is not None:
            conditions.append(User.status == status)

        base = select(User)
        count_q = select(func.count(User.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def count(self, db: Session) -> int:
        return db.execute(select(func.count(User.id))).scalar_one()

    def count_since(self, db: Session, since: datetime) -> int:
        return db.execute(select(func.count(User.id)).where(User.created_at >= since)).scalar_one()

    def list_active(self, db: Session) -> list[User]:
        return list(
            db.execute(
                select(User).where(User.is_active.is_(True)).order_by(User.created_at)
            ).scalars().all()
        )

    def list_admins(self, db: Session) -> list[User]:
        return list(
            db.execute(
                select(User).where(User.is_active.is_(True)).where(
                    or_(User.role == UserRole.ADMIN, User.roles.contains([UserRole.ADMIN.value]))
                )
            ).scalars().all()
        )


user_repository = UserRepository()