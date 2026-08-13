from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole, UserStatus


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    role: UserRole
    roles: list[str] = []
    status: UserStatus
    provider: str
    avatar: str | None
    is_active: bool
    is_verified: bool
    preferences: dict
    created_at: datetime


class InviteUserRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: UserRole = UserRole.USER


class BulkInviteEntry(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: UserRole = UserRole.USER


class BulkInviteRequest(BaseModel):
    users: list[BulkInviteEntry] = Field(min_length=1, max_length=100)


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


class UpdateUserRolesRequest(BaseModel):
    roles: list[UserRole] = Field(min_length=1, max_length=2)


class UpdateUserStatusRequest(BaseModel):
    status: UserStatus