from datetime import timedelta
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.security import create_token
from app.models.enums import AuditAction, AuditCategory, UserRole, UserStatus
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.user_repository import user_repository
from app.schemas.user import UserOut

ROLE_DEFINITIONS = {
    UserRole.USER: {
        "name": "user",
        "label": "User",
        "description": "Standard member with access to contributions, savings and transactions.",
        "permissions": [
            "contributions.view",
            "contributions.join",
            "contributions.pay",
            "savings.view",
            "savings.fund",
            "withdrawals.request",
            "withdrawals.view_own",
            "transactions.view_own",
            "notifications.view",
        ],
    },
    UserRole.ADMIN: {
        "name": "admin",
        "label": "Admin",
        "description": "Full platform control: user, contribution, withdrawal and transaction management.",
        "permissions": [
            "all",
        ],
    },
}


class UserService:
    def update_avatar(self, db: Session, *, user: User, file) -> User:
        from app.core.cloudinary import delete_image, upload_image

        old_public_id = user.avatar_public_id
        result = upload_image(file.file, public_id=f"user-{user.id}")

        if old_public_id:
            delete_image(old_public_id)

        user.avatar = result["url"]
        user.avatar_public_id = result["public_id"]
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.USER,
            description="Updated profile photo.",
            details={"public_id": result["public_id"]},
        )
        return user

    def remove_avatar(self, db: Session, *, user: User) -> User:
        from app.core.cloudinary import delete_image

        if user.avatar_public_id:
            delete_image(user.avatar_public_id)

        user.avatar = None
        user.avatar_public_id = None
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.USER,
            description="Removed profile photo.",
        )
        return user

    def list_users(self, db: Session, *, search=None, role=None, status: UserStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = user_repository.list_users(
            db, search=search, role=role, status=status, page=page, page_size=page_size
        )
        return {
            "items": [UserOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def role_summary(self, db: Session) -> list[dict]:
        counts = dict(
            db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all()
        )

        result = []
        for role, definition in ROLE_DEFINITIONS.items():
            result.append(
                {
                    "name": definition["name"],
                    "label": definition["label"],
                    "description": definition["description"],
                    "permissions": definition["permissions"],
                    "user_count": counts.get(role, 0),
                }
            )
        return result

    def get_user(self, db: Session, user_id: uuid.UUID) -> User:
        user = user_repository.get(db, user_id)
        if user is None:
            raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")
        return user

    def set_role(self, db: Session, *, actor: User, user_id: uuid.UUID, role) -> User:
        user = self.get_user(db, user_id)
        if user.id == actor.id and role != "admin":
            raise AppException(
                message="You cannot demote your own admin role.",
                status_code=400,
                error_code="CANNOT_DEMOTE_SELF",
            )
        old_role = user.role
        user.role = role
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.USER,
            description=f"Changed {user.email} role from {old_role} to {role}.",
            target=user.email,
            target_id=user.id,
        )
        return user

    def set_status(self, db: Session, *, actor: User, user_id: uuid.UUID, status: UserStatus) -> User:
        user = self.get_user(db, user_id)
        if user.id == actor.id and status != UserStatus.ACTIVE:
            raise AppException(
                message="You cannot suspend your own account.",
                status_code=400,
                error_code="CANNOT_SUSPEND_SELF",
            )
        old_status = user.status
        user.status = status
        if status == UserStatus.SUSPENDED:
            user.is_active = False
        if status == UserStatus.ACTIVE:
            user.is_active = True
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.SUSPEND if status == UserStatus.SUSPENDED else AuditAction.REACTIVATE,
            category=AuditCategory.USER,
            description=f"Changed {user.email} status from {old_status} to {status}.",
            target=user.email,
            target_id=user.id,
        )
        return user

    def delete_user(self, db: Session, *, actor: User, user_id: uuid.UUID) -> None:
        user = self.get_user(db, user_id)
        if user.id == actor.id:
            raise AppException(
                message="You cannot delete your own account through user management.",
                status_code=400,
                error_code="CANNOT_DELETE_SELF",
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.DELETE,
            category=AuditCategory.USER,
            description=f"Deleted user {user.email}.",
            target=user.email,
            target_id=user.id,
        )
        db.delete(user)
        db.flush()

    def invite_user(self, db: Session, *, actor: User, first_name: str, last_name: str, email: str, role) -> User:
        normalized = email.strip().lower()
        if user_repository.get_by_email(db, normalized):
            raise AppException(
                message="A user with this email already exists.",
                status_code=409,
                error_code="EMAIL_ALREADY_REGISTERED",
            )

        user = user_repository.create(
            db,
            first_name=first_name,
            last_name=last_name,
            email=normalized,
            password=create_token(subject=str(uuid.uuid4()), token_type="invite", expires_delta=timedelta(days=7)),
            status=UserStatus.INVITED,
            role=role,
        )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.INVITE,
            category=AuditCategory.USER,
            description=f"Invited {user.email} as {role}.",
            target=user.email,
            target_id=user.id,
        )
        return user

    def bulk_invite(self, db: Session, *, actor: User, users) -> list[User]:
        created: list[User] = []
        for entry in users:
            normalized = entry.email.strip().lower()
            if user_repository.get_by_email(db, normalized):
                continue
            user = user_repository.create(
                db,
                first_name=entry.first_name,
                last_name=entry.last_name,
                email=normalized,
                password=create_token(subject=str(uuid.uuid4()), token_type="invite", expires_delta=timedelta(days=7)),
                status=UserStatus.INVITED,
                role=entry.role,
            )
            created.append(user)

        if created:
            audit_log_repository.create(
                db,
                actor_id=actor.id,
                actor_name=f"{actor.first_name} {actor.last_name}",
                actor_email=actor.email,
                actor_role=actor.role,
                action=AuditAction.INVITE,
                category=AuditCategory.USER,
                description=f"Bulk invited {len(created)} user(s).",
                details={"emails": [u.email for u in created]},
            )
        return created


user_service = UserService()