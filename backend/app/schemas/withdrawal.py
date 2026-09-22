from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models.enums import WithdrawalChannel, WithdrawalSource, WithdrawalStatus


def mask_account(number: str | None) -> str | None:
    if not number:
        return None
    digits = number[-4:]
    return f"****{digits}"


class WithdrawalCreate(BaseModel):
    amount: int = Field(gt=0)
    withdrawal_type: str = Field(description='"savings" or "contribution"')
    channel: WithdrawalChannel | None = Field(
        default=None, description='Destination for the money: "wallet" or "bank".'
    )
    source: str | None = Field(default=None, description='"user"/"emergency" for self-served requests')
    reason: str | None = Field(default=None, max_length=1000, description="Emergency/request reason")
    bank_account_id: uuid.UUID | None = None
    bank_name: str | None = Field(default=None, min_length=1, max_length=120)
    account_number: str | None = Field(default=None, min_length=1, max_length=30)
    account_name: str | None = Field(default=None, max_length=120)
    destination: str | None = Field(default=None, min_length=1, max_length=200)
    contribution_id: uuid.UUID | None = None
    savings_plan_id: uuid.UUID | None = Field(default=None, description="Completed Savings Plan to withdraw from")

    @field_validator("withdrawal_type")
    @classmethod
    def _validate_type(cls, value: str) -> str:
        if value not in ("savings", "contribution"):
            raise ValueError("withdrawal_type must be 'savings' or 'contribution'")
        return value

    @field_validator("source")
    @classmethod
    def _validate_source(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in ("user", "emergency"):
            raise ValueError("source must be 'user' or 'emergency'")
        return value


class WithdrawalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    amount: int
    withdrawal_type: str
    channel: WithdrawalChannel
    source: WithdrawalSource
    reason: str | None
    admin_note: str | None
    bank_name: str | None
    account_number: str | None
    account_name: str | None
    destination: str
    contribution_name: str | None
    related_savings_plan_id: uuid.UUID | None
    related_contribution_id: uuid.UUID | None
    status: WithdrawalStatus
    requested_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None

    gross_amount: int | None
    commission_rate: float | None
    commission_type: str | None
    commission_amount: int | None
    fee_amount: int | None
    net_amount: int | None

    bank_account_id: uuid.UUID | None
    paystack_recipient_code: str | None
    paystack_transfer_code: str | None
    paystack_reference: str | None
    admin_id: uuid.UUID | None
    approved_at: datetime | None
    completed_at: datetime | None
    rejected_at: datetime | None
    failure_reason: str | None

    @computed_field
    @property
    def masked_account_number(self) -> str | None:
        return mask_account(self.account_number)

    @computed_field
    @property
    def processing_message(self) -> str | None:
        if self.status == WithdrawalStatus.PENDING:
            return (
                "Withdrawal request submitted. Your withdrawal will be "
                "reviewed and processed within 24 hours."
            )
        return None


class WithdrawalList(BaseModel):
    items: list[WithdrawalOut]
    total: int
    page: int
    page_size: int
    pages: int


class WithdrawalPreviewRequest(BaseModel):
    amount: int = Field(gt=0)
    withdrawal_type: str = Field(description='"savings" or "contribution"')
    channel: WithdrawalChannel | None = None
    source: str | None = Field(default=None, description='"user", "emergency" or "admin"')
    savings_plan_id: uuid.UUID | None = None
    contribution_id: uuid.UUID | None = None


class WithdrawalPreviewOut(BaseModel):
    amount: int
    source: str
    channel: str
    gross: int
    commission: int
    commission_rate: float | None = None
    commission_type: str | None = None
    fee: int | None = None
    net: int


class WithdrawalReview(BaseModel):
    status: str = Field(description='"approved" or "rejected"')
    reason: str | None = Field(default=None, max_length=500)


class AdminPayoutRequest(BaseModel):
    user_id: uuid.UUID
    amount: int = Field(gt=0)
    channel: WithdrawalChannel = WithdrawalChannel.BANK
    reason: str | None = Field(default=None, max_length=1000)
    admin_note: str | None = Field(default=None, max_length=1000)
    bank_account_id: uuid.UUID | None = None
    savings_plan_id: uuid.UUID | None = None
    contribution_id: uuid.UUID | None = None