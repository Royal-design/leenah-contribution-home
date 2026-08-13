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


class TransactionList(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionFilter(BaseModel):
    type: TransactionType | None = None
    status: TransactionStatus | None = None