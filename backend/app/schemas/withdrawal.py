from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import WithdrawalStatus


class WithdrawalCreate(BaseModel):
    amount: int = Field(gt=0)
    withdrawal_type: str = Field(description='"savings" or "contribution"')
    bank_name: str = Field(min_length=1, max_length=120)
    account_number: str = Field(min_length=1, max_length=30)
    account_name: str | None = Field(default=None, max_length=120)
    destination: str = Field(min_length=1, max_length=200)
    contribution_id: uuid.UUID | None = None


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


class WithdrawalList(BaseModel):
    items: list[WithdrawalOut]
    total: int
    page: int
    page_size: int
    pages: int


class WithdrawalReview(BaseModel):
    status: str = Field(description='"approved" or "rejected"')