from enum import StrEnum


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INVITED = "invited"


class AuthProvider(StrEnum):
    CREDENTIALS = "credentials"
    GOOGLE = "google"


class Frequency(StrEnum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class ContributionStatus(StrEnum):
    ACTIVE = "active"
    UPCOMING = "upcoming"
    COMPLETED = "completed"
    PAUSED = "paused"
    DRAFT = "draft"


class ScheduleStatus(StrEnum):
    PAID = "paid"
    PENDING = "pending"
    UPCOMING = "upcoming"


class MemberStatus(StrEnum):
    ACTIVE = "active"
    LEFT = "left"
    REMOVED = "removed"


class FundingMethod(StrEnum):
    WALLET = "wallet"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"


class PayoutStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    SKIPPED = "skipped"


class WithdrawalRuleType(StrEnum):
    ON_SCHEDULE = "on_schedule"
    FIXED_DATE = "fixed_date"


class SavingsGoalStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class TransactionType(StrEnum):
    CONTRIBUTION = "contribution"
    SAVINGS = "savings"
    FUNDING = "funding"
    WITHDRAWAL = "withdrawal"


class TransactionStatus(StrEnum):
    SUCCESSFUL = "successful"
    PENDING = "pending"
    FAILED = "failed"
    REVERTED = "reverted"


class WithdrawalStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSING = "processing"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class DVStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    FAILED = "failed"
    INACTIVE = "inactive"


class PaymentProvider(StrEnum):
    PAYSTACK = "paystack"
    MOCK = "mock"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    REVERSED = "reversed"


class PaymentPurpose(StrEnum):
    WALLET_FUNDING = "wallet_funding"
    CONTRIBUTION_FUNDING = "contribution_funding"


class WebhookEventStatus(StrEnum):
    RECEIVED = "received"
    PROCESSED = "processed"
    FAILED = "failed"


class NotificationType(StrEnum):
    CONTRIBUTION = "contribution"
    SAVINGS = "savings"
    WITHDRAWAL = "withdrawal"
    SYSTEM = "system"


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"
    PASSWORD_RESET = "password_reset"


class AuditAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    REJECT = "reject"
    REVERT = "revert"
    SUSPEND = "suspend"
    REACTIVATE = "reactivate"
    INVITE = "invite"
    LOGIN = "login"
    LOGOUT = "logout"
    SETTINGS_UPDATE = "settings_update"


class AuditCategory(StrEnum):
    USER = "user"
    CONTRIBUTION = "contribution"
    SAVINGS = "savings"
    WITHDRAWAL = "withdrawal"
    TRANSACTION = "transaction"
    SYSTEM = "system"
    SETTINGS = "settings"


class SupportCategory(StrEnum):
    GENERAL = "general"
    ACCOUNT = "account"
    CONTRIBUTION = "contribution"
    SAVINGS = "savings"
    WITHDRAWAL = "withdrawal"
    OTHER = "other"


class SupportStatus(StrEnum):
    OPEN = "open"
    REPLIED = "replied"
    RESOLVED = "resolved"