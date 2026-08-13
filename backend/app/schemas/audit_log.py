from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import AuditAction, AuditCategory


class AuditLogRecord(BaseModel):
    action: AuditAction
    category: AuditCategory
    description: str
    actor_id: uuid.UUID | None = None
    actor_name: str | None = None
    actor_email: str | None = None
    actor_role: str | None = None
    target: str | None = None
    target_id: uuid.UUID | None = None
    details: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_name: str | None
    actor_email: str | None
    actor_role: str | None
    action: AuditAction
    category: AuditCategory
    description: str
    target: str | None
    target_id: uuid.UUID | None
    details: dict | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int
    pages: int