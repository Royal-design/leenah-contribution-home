from pydantic import BaseModel, Field

from app.models.enums import CommissionType

COMMISSION_KEYS = (
    "wallet_withdrawal",
    "savings_withdrawal",
    "contribution_withdrawal",
    "contribution_payout",
    "emergency_withdrawal",
    "admin_payout",
)


class CommissionEntry(BaseModel):
    enabled: bool = False
    type: CommissionType = CommissionType.PERCENTAGE
    rate: float = Field(default=0, ge=0, le=100)
    fixed: int = Field(default=0, ge=0)


class CommissionDefaults(BaseModel):
    wallet_withdrawal: CommissionEntry = CommissionEntry()
    savings_withdrawal: CommissionEntry = CommissionEntry()
    contribution_withdrawal: CommissionEntry = CommissionEntry()
    contribution_payout: CommissionEntry = CommissionEntry()
    emergency_withdrawal: CommissionEntry = CommissionEntry()
    admin_payout: CommissionEntry = CommissionEntry()


class CommissionSettingsOut(BaseModel):
    defaults: dict
    keys: list[str]


class CommissionSettingsUpdate(BaseModel):
    defaults: dict = Field(description="Keyed by transaction type; each entry: enabled/type/rate/fixed")