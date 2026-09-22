from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import TransactionStatus, TransactionType


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    type: TransactionType
    status: TransactionStatus
    amount: int
    description: str
    reference: str
    details: dict | None
    date: datetime
    currency: str = "NGN"
    source: str | None = None
    gross_amount: int | None = None
    commission_rate: float | None = None
    commission_type: str | None = None
    commission_amount: int | None = None
    fee_amount: int | None = None
    net_amount: int | None = None
    related_savings_plan_id: uuid.UUID | None = None
    related_contribution_id: uuid.UUID | None = None
    related_withdrawal_id: uuid.UUID | None = None
    related_emergency_request_id: uuid.UUID | None = None
    completed_at: datetime | None = None
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    failure_reason: str | None = None


class TransactionList(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionFilter(BaseModel):
    type: TransactionType | None = None
    status: TransactionStatus | None = None