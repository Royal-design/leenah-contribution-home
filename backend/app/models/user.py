from datetime import datetime, timezone
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import AuthProvider, UserRole, UserStatus

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.contribution import ContributionMember
    from app.models.notification import Notification
    from app.models.payment import Payment
    from app.models.refresh_token import RefreshToken
    from app.models.savings_account import SavingsAccount
    from app.models.support_thread import SupportThread
    from app.models.transaction import Transaction
    from app.models.user_bank_account import UserBankAccount
    from app.models.withdrawal import Withdrawal

DEFAULT_PREFERENCES = {
    "notifications": True,
    "marketing": False,
    "currency": "NGN",
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String)
    password: Mapped[str] = mapped_column(Text, nullable=False)

    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.USER)
    roles: Mapped[list[str]] = mapped_column(
        JSONB, default=lambda: [UserRole.USER], nullable=False
    )
    status: Mapped[UserStatus] = mapped_column(SAEnum(UserStatus), nullable=False, default=UserStatus.ACTIVE)
    provider: Mapped[AuthProvider] = mapped_column(SAEnum(AuthProvider), nullable=False, default=AuthProvider.CREDENTIALS)

    avatar: Mapped[str | None] = mapped_column(Text)
    avatar_public_id: Mapped[str | None] = mapped_column(String)

    preferences: Mapped[dict] = mapped_column(JSONB, default=lambda: DEFAULT_PREFERENCES.copy(), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Paystack identifiers. Created lazily on first DVA/card use; never re-created.
    paystack_customer_code: Mapped[str | None] = mapped_column(String, unique=True, index=True)
    paystack_customer_id: Mapped[str | None] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def is_admin(self) -> bool:
        return UserRole.ADMIN in self.roles or self.role == UserRole.ADMIN

    # Relationships
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    savings_account: Mapped["SavingsAccount | None"] = relationship(back_populates="user", cascade="all, delete-orphan")
    withdrawals: Mapped[list["Withdrawal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    memberships: Mapped[list["ContributionMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    bank_accounts: Mapped[list["UserBankAccount"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor")
    support_threads: Mapped[list["SupportThread"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user", cascade="all, delete-orphan")