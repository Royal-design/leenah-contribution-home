from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SupportCategory, SupportStatus


class SupportThreadCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    category: SupportCategory = SupportCategory.GENERAL
    message: str = Field(min_length=1, max_length=4000)


class SupportMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class SupportStatusUpdate(BaseModel):
    status: SupportStatus


class SupportMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    thread_id: uuid.UUID
    sender_id: uuid.UUID | None
    sender_role: str
    sender_name: str
    body: str
    is_read: bool
    created_at: datetime


class SupportThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    subject: str
    category: SupportCategory
    status: SupportStatus
    unread_count: int
    last_message_at: datetime
    created_at: datetime
    updated_at: datetime


class SupportThreadDetail(SupportThreadOut):
    messages: list[SupportMessageOut] = []


class SupportThreadList(BaseModel):
    items: list[SupportThreadOut]
    total: int
    page: int
    page_size: int
    pages: int


class UnreadCount(BaseModel):
    unread_threads: int