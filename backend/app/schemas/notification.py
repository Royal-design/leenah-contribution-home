from datetime import datetime, timezone
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.enums import NotificationType


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    title: str
    message: str | None
    is_read: bool
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _as_utc(value).isoformat()


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class MarkReadResponse(BaseModel):
    marked: int


class BroadcastMessageRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType = NotificationType.SYSTEM


class DirectMessageRequest(BaseModel):
    user_id: uuid.UUID
    title: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=2000)
    type: NotificationType = NotificationType.SYSTEM