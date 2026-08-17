from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.models.enums import WithdrawalStatus


def mask_account(number: str) -> str:
    digits = number[-4:]
    return f"****{digits}"


class WithdrawalCreate(BaseModel):
    amount: int = Field(gt=0)
    withdrawal_type: str = Field(description='"savings" or "contribution"')
    bank_account_id: uuid.UUID | None = None
    bank_name: str | None = Field(default=None, min_length=1, max_length=120)
    account_number: str | None = Field(default=None, min_length=1, max_length=30)
    account_name: str | None = Field(default=None, max_length=120)
    destination: str | None = Field(default=None, min_length=1, max_length=200)
    contribution_id: uuid.UUID | None = None

    @field_validator("withdrawal_type")
    @classmethod
    def _validate_type(cls, value: str) -> str:
        if value not in ("savings", "contribution"):
            raise ValueError("withdrawal_type must be 'savings' or 'contribution'")
        return value


class WithdrawalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    amount: int
    withdrawal_type: str
    bank_name: str
    account_number: str
    account_name: str | None
    destination: str
    contribution_name: str | None
    status: WithdrawalStatus
    requested_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None

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
    def masked_account_number(self) -> str:
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


class WithdrawalReview(BaseModel):
    status: str = Field(description='"approved" or "rejected"')
    reason: str | None = Field(default=None, max_length=500)
