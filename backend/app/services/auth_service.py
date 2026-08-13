from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_password_reset_email
from app.core.exceptions import AppException
from app.core.security import create_access_token, create_refresh_token, create_token, decode_token, hash_password, verify_password
from app.models.enums import AuditAction, AuditCategory, AuthProvider
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.refresh_token_repository import refresh_token_repository
from app.repositories.savings_repository import savings_account_repository
from app.repositories.user_repository import user_repository
from app.schemas.auth import AuthResponse, TokenResponse, UpdateProfileRequest
from app.schemas.user import UserOut

PASSWORD_RESET_TTL_MINUTES = 30


def _build_auth_response(db: Session, user: User, refresh_token: str, access_token: str) -> AuthResponse:
    return AuthResponse(
        user=UserOut.model_validate(user),
        access_token=access_token,
        refresh_token=refresh_token,
    )


def _issue_tokens(db: Session, user: User, *, user_agent: str | None, ip_address: str | None) -> TokenResponse:
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(user.id, jti)
    refresh_token_repository.create(
        db,
        token_jti=jti,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=refresh_token,
    )


class AuthService:
    def register(
        self,
        db: Session,
        *,
        first_name: str,
        last_name: str,
        email: str,
        password: str,
        phone: str | None,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        normalized_email = email.strip().lower()
        if user_repository.get_by_email(db, normalized_email):
            raise AppException(
                message="An account with this email already exists.",
                status_code=409,
                error_code="EMAIL_ALREADY_REGISTERED",
            )

        user = user_repository.create(
            db,
            first_name=first_name,
            last_name=last_name,
            email=normalized_email,
            password=hash_password(password),
            phone=phone,
        )

        savings_account_repository.create_for_user(db, user.id)

        tokens = _issue_tokens(db, user, user_agent=user_agent, ip_address=ip_address)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.USER,
            description=f"Registered a new account.",
            details={"provider": user.provider},
            ip_address=ip_address,
        )

        return _build_auth_response(db, user, tokens.refresh_token, tokens.access_token)

    def login(
        self,
        db: Session,
        *,
        email: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        user = user_repository.get_by_email(db, email.strip().lower())
        if user is None or not verify_password(password, user.password):
            raise AppException(
                message="Invalid email or password.",
                status_code=401,
                error_code="INVALID_CREDENTIALS",
            )

        if not user.is_active:
            raise AppException(
                message="This account has been disabled. Contact support.",
                status_code=403,
                error_code="ACCOUNT_DISABLED",
            )

        tokens = _issue_tokens(db, user, user_agent=user_agent, ip_address=ip_address)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.LOGIN,
            category=AuditCategory.SYSTEM,
            description="Signed in.",
            ip_address=ip_address,
        )

        return _build_auth_response(db, user, tokens.refresh_token, tokens.access_token)

    def google_login(
        self,
        db: Session,
        *,
        access_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthResponse:
        import httpx

        with httpx.Client(timeout=10) as client:
            token_resp = client.get(
                f"https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={access_token}"
            )
            if token_resp.status_code != 200:
                raise AppException(
                    message="Invalid Google token.",
                    status_code=401,
                    error_code="INVALID_GOOGLE_TOKEN",
                )

            token_data = token_resp.json()
            if token_data.get("aud") != settings.google_client_id:
                raise AppException(
                    message="Invalid Google token audience.",
                    status_code=401,
                    error_code="INVALID_GOOGLE_TOKEN",
                )

            profile_resp = client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile_resp.status_code != 200:
                raise AppException(
                    message="Invalid Google token.",
                    status_code=401,
                    error_code="INVALID_GOOGLE_TOKEN",
                )

            data = profile_resp.json()

        email = data.get("email", "").lower().strip()
        if not email:
            raise AppException(
                message="Google account has no email.",
                status_code=400,
                error_code="GOOGLE_NO_EMAIL",
            )

        first_name = data.get("given_name") or email.split("@")[0]
        last_name = data.get("family_name") or ""
        avatar = data.get("picture")

        user = user_repository.get_by_email(db, email)
        if user is None:
            user = user_repository.create(
                db,
                first_name=first_name,
                last_name=last_name,
                email=email,
                password=hash_password(uuid.uuid4().hex),
                provider=AuthProvider.GOOGLE,
            )
            user.avatar = avatar
            user.is_verified = True
            savings_account_repository.create_for_user(db, user.id)
        else:
            if user.provider != AuthProvider.GOOGLE:
                user.provider = AuthProvider.GOOGLE
            if avatar:
                user.avatar = avatar
            user.is_verified = True

        if not user.is_active:
            raise AppException(
                message="This account has been disabled. Contact support.",
                status_code=403,
                error_code="ACCOUNT_DISABLED",
            )

        tokens = _issue_tokens(db, user, user_agent=user_agent, ip_address=ip_address)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.LOGIN,
            category=AuditCategory.SYSTEM,
            description="Signed in with Google.",
            ip_address=ip_address,
        )

        return _build_auth_response(db, user, tokens.refresh_token, tokens.access_token)

    def refresh(
        self,
        db: Session,
        *,
        refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AppException(
                message="Invalid refresh token.",
                status_code=401,
                error_code="INVALID_TOKEN",
            )

        jti = payload.get("jti")
        stored = refresh_token_repository.get_active(db, jti) if jti else None
        if stored is None:
            raise AppException(
                message="Refresh token has expired or been revoked.",
                status_code=401,
                error_code="TOKEN_EXPIRED",
            )

        user = db.get(User, stored.user_id)
        if user is None or not user.is_active:
            raise AppException(
                message="User account is no longer available.",
                status_code=401,
                error_code="INVALID_TOKEN",
            )

        # Rotate: revoke old token, issue new pair.
        refresh_token_repository.revoke(db, stored)

        new_jti = str(uuid.uuid4())
        new_refresh = create_refresh_token(user.id, new_jti)
        refresh_token_repository.create(
            db,
            token_jti=new_jti,
            user_id=user.id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            user_agent=user_agent,
            ip_address=ip_address,
        )

        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=new_refresh,
        )

    def logout(self, db: Session, refresh_token: str) -> None:
        payload = decode_token(refresh_token)
        jti = payload.get("jti")
        stored = refresh_token_repository.get_active(db, jti) if jti else None
        if stored is not None:
            refresh_token_repository.revoke(db, stored)
            user = db.get(User, stored.user_id)
            if user:
                audit_log_repository.create(
                    db,
                    actor_id=user.id,
                    actor_name=f"{user.first_name} {user.last_name}",
                    actor_email=user.email,
                    actor_role=user.role,
                    action=AuditAction.LOGOUT,
                    category=AuditCategory.SYSTEM,
                    description="Signed out.",
                )

    def request_password_reset(self, db: Session, *, email: str) -> None:
        user = user_repository.get_by_email(db, email.strip().lower())
        if user is None:
            # Do not leak whether an account exists.
            return

        token = _create_password_reset_token(user)
        send_password_reset_email(user.email, token)

    def reset_password(self, db: Session, *, token: str, new_password: str) -> None:
        payload = decode_token(token)
        if payload.get("type") != "password_reset":
            raise AppException(
                message="Invalid reset token.",
                status_code=400,
                error_code="INVALID_TOKEN",
            )

        try:
            user_id = uuid.UUID(str(payload.get("sub")))
        except (ValueError, TypeError):
            raise AppException(message="Invalid reset token.", status_code=400, error_code="INVALID_TOKEN")

        user = db.get(User, user_id)
        if user is None:
            raise AppException(message="User account no longer exists.", status_code=404, error_code="USER_NOT_FOUND")

        user.password = hash_password(new_password)
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SYSTEM,
            description="Reset account password.",
        )

    def change_password(self, db: Session, *, user: User, current_password: str, new_password: str) -> None:
        if not verify_password(current_password, user.password):
            raise AppException(
                message="Current password is incorrect.",
                status_code=400,
                error_code="INVALID_CURRENT_PASSWORD",
            )

        user.password = hash_password(new_password)
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SYSTEM,
            description="Changed account password.",
        )

    def update_profile(self, db: Session, *, user: User, payload: UpdateProfileRequest) -> User:
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            if value is not None:
                setattr(user, key, value)
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.USER,
            description="Updated profile information.",
        )

        return user

    def delete_account(self, db: Session, *, user: User, ip_address: str | None = None) -> None:
        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.USER,
            description="Deleted account.",
            ip_address=ip_address,
        )
        db.delete(user)
        db.flush()


def _create_password_reset_token(user: User) -> str:
    return create_token(
        subject=user.id,
        token_type="password_reset",
        expires_delta=timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
    )


auth_service = AuthService()