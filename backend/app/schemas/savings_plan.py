from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import (
    EnrollmentStatus,
    Frequency,
    FundingMethod,
    SavingsPlanStatus,
    ScheduleStatus,
)


class SavingsPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    organization: str | None = None
    amount: int = Field(gt=0)
    target_amount: int | None = Field(default=None, ge=1)
    frequency: Frequency
    start_date: datetime
    # Duration in whole calendar months. The backend derives end_date from it.
    duration_months: int | None = Field(default=None, ge=1, le=240)
    end_date: datetime | None = None
    status: SavingsPlanStatus | None = None
    is_open: bool = True

    @model_validator(mode="after")
    def _validate_dates(self) -> "SavingsPlanCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.end_date is None and self.duration_months is None:
            raise ValueError("Provide either a duration or an end date.")
        return self


class SavingsPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    organization: str | None = None
    amount: int | None = Field(default=None, gt=0)
    target_amount: int | None = Field(default=None, ge=1)
    frequency: Frequency | None = None
    start_date: datetime | None = None
    duration_months: int | None = Field(default=None, ge=1, le=240)
    end_date: datetime | None = None
    next_payment_date: datetime | None = None
    status: SavingsPlanStatus | None = None
    is_open: bool | None = None

    @model_validator(mode="after")
    def _validate_dates(self) -> "SavingsPlanUpdate":
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SavingsPlanScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period: str
    label: str | None
    due_date: datetime
    status: ScheduleStatus
    amount: int
    paid_at: datetime | None = None
    transaction_id: uuid.UUID | None = None
    attempt_count: int = 0
    failure_reason: str | None = None


class SavingsPlanEnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan_id: uuid.UUID
    user_id: uuid.UUID
    total_saved: int
    next_payment_date: datetime | None = None
    status: EnrollmentStatus
    joined_at: datetime


class SavingsPlanEnrollmentDetailOut(BaseModel):
    """Enrollment row enriched with the member's name/email for admins."""

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_email: str | None = None
    total_saved: int
    next_payment_date: datetime | None = None
    status: EnrollmentStatus
    joined_at: datetime


class PaySavingsPlanRequest(BaseModel):
    schedule_id: int | None = None
    funding_method: FundingMethod = FundingMethod.WALLET


class SavingsPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    organization: str | None
    amount: int
    target_amount: int | None
    frequency: Frequency
    duration_months: int | None
    start_date: datetime
    end_date: datetime | None
    next_payment_date: datetime | None
    last_payment_date: datetime | None
    rounds: int
    total_saved: int
    total_expected: int
    progress: int
    status: SavingsPlanStatus
    is_open: bool
    enroll_count: int = 0
    created_by: uuid.UUID
    created_at: datetime
    enrollment: SavingsPlanEnrollmentOut | None = None
    schedule: list[SavingsPlanScheduleOut] = []


class SavingsPlanList(BaseModel):
    items: list[SavingsPlanOut]
    total: int
    page: int
    page_size: int
    pages: int