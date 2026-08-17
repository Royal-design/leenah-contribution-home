from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.enums import DVStatus


class DVAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    paystack_customer_code: str
    paystack_dedicated_account_id: str | None
    account_number: str | None
    account_name: str | None
    bank_name: str | None
    bank_slug: str | None
    currency: str
    status: DVStatus
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def funding_instruction(self) -> str:
        return (
            "Transfer money from your bank account to this account. "
            "Your wallet will be credited after the transfer is confirmed."
        )


class DVAStatusOut(BaseModel):
    dva: DVAccountOut | None = None
    message: str | None = None


class CardFundInitializeRequest(BaseModel):
    amount: int = Field(gt=0, description="Amount in naira")
    callback_url: str | None = Field(default=None, max_length=500)


class CardFundInitializeOut(BaseModel):
    authorization_url: str
    reference: str
    access_code: str | None = None


class BankAccountResolveRequest(BaseModel):
    account_number: str = Field(min_length=5, max_length=30)
    bank_code: str = Field(min_length=1, max_length=20)


class BankAccountResolveOut(BaseModel):
    account_number: str
    bank_code: str
    bank_name: str
    account_name: str
    verified: bool = True
    masked_account_number: str


class BankOut(BaseModel):
    name: str
    code: str
    slug: str
    longcode: str | None = None


class WithdrawalRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class WithdrawalApproveRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
