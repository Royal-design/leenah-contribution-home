from pydantic import BaseModel, Field

from app.schemas.savings import SavingsAccountDetail


class MockFundRequest(BaseModel):
    amount: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=200)


class WalletOut(BaseModel):
    balance: int
    total_saved: int
    total_withdrawn: int
    account: SavingsAccountDetail | None = None
