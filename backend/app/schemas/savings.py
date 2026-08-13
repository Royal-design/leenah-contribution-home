from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SavingsGoalStatus


class SavingsAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    balance: int
    total_saved: int
    total_withdrawn: int
    created_at: datetime
    updated_at: datetime


class SavingsGoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    name: str
    target: int
    current: int
    status: SavingsGoalStatus
    color: str | None
    target_date: datetime | None
    created_at: datetime


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target: int = Field(gt=0)
    color: str | None = Field(default=None, max_length=30)
    target_date: datetime | None = None


class SavingsGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target: int | None = Field(default=None, gt=0)
    color: str | None = None
    status: SavingsGoalStatus | None = None
    target_date: datetime | None = None


class FundSavingsRequest(BaseModel):
    amount: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=200)
    goal_id: uuid.UUID | None = Field(default=None)


class SavingsAccountDetail(SavingsAccountOut):
    goals: list[SavingsGoalOut] = []