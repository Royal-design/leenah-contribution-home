from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class UserBankAccountCreate(BaseModel):
    bank_code: str | None = Field(default=None, max_length=20)
    bank_name: str = Field(min_length=1, max_length=120)
    account_number: str = Field(min_length=5, max_length=30)
    account_name: str | None = Field(default=None, max_length=120)
    is_default: bool = False


class UserBankAccountUpdate(BaseModel):
    bank_code: str | None = Field(default=None, max_length=20)
    bank_name: str | None = Field(default=None, max_length=120)
    account_number: str | None = Field(default=None, min_length=5, max_length=30)
    account_name: str | None = Field(default=None, max_length=120)
    is_default: bool | None = None


class UserBankAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    bank_code: str | None
    bank_name: str
    account_number: str
    account_name: str | None
    is_verified: bool
    is_default: bool
    provider_recipient_code: str | None
    created_at: datetime
