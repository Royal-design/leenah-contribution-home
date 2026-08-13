from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    ContributionStatus,
    Frequency,
    ScheduleStatus,
    WithdrawalRuleType,
)


class ContributionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    organization: str | None = None
    amount: int = Field(gt=0)
    frequency: Frequency
    member_count: int = Field(ge=1, le=500)
    rounds: int = Field(default=12, ge=1, le=120)
    start_date: datetime
    end_date: datetime | None = None
    withdrawal_rule: WithdrawalRuleType | None = None
    fixed_withdrawal_date: datetime | None = None


class ContributionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    organization: str | None = None
    amount: int | None = Field(default=None, gt=0)
    frequency: Frequency | None = None
    member_count: int | None = Field(default=None, ge=1, le=500)
    rounds: int | None = Field(default=None, ge=1, le=120)
    start_date: datetime | None = None
    end_date: datetime | None = None
    withdrawal_date: datetime | None = None
    status: ContributionStatus | None = None
    is_open: bool | None = None


class ContributionScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period: str
    label: str | None
    due_date: datetime
    status: ScheduleStatus
    amount: int


class ContributionMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    avatar: str | None
    position: int
    total_contributed: int
    joined_at: datetime


class ContributionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    organization: str | None
    amount: int
    frequency: Frequency
    member_count: int
    rounds: int
    start_date: datetime
    end_date: datetime | None
    withdrawal_date: datetime | None
    next_payment_date: datetime | None
    last_payment_date: datetime | None
    total_contributed: int
    total_expected: int
    progress: int
    status: ContributionStatus
    withdrawal_rule: dict | None
    is_open: bool
    created_by: uuid.UUID
    created_at: datetime
    members: list[ContributionMemberOut] = []
    schedule: list[ContributionScheduleOut] = []


class ContributionList(BaseModel):
    items: list[ContributionOut]
    total: int
    page: int
    page_size: int
    pages: int


class PayContributionRequest(BaseModel):
    schedule_id: int | None = None
    amount: int | None = Field(default=None, gt=0)


class ContributionMemberAdd(BaseModel):
    user_id: uuid.UUID