from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_admin
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory
from app.models.user import User
from app.schemas.audit_log import AuditLogList, AuditLogOut
from app.schemas.response import MessageResponse, SuccessResponse
from app.services.audit_log_service import audit_log_service


router = APIRouter(tags=["Audit Logs"])


@router.get("", response_model=SuccessResponse[AuditLogList])
def list_audit_logs(
    db: Session = Depends(get_db),
    _: None = Depends(get_current_admin),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    action: AuditAction | None = Query(default=None),
    category: AuditCategory | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
):
    result = audit_log_service.list_logs(
        db,
        action=action,
        category=category,
        search=search,
        from_date=from_date,
        to_date=to_date,
        page=page,
        page_size=page_size,
    )
    return SuccessResponse(message="Audit logs retrieved.", data=result)


@router.get("/actions")
def list_actions(_: None = Depends(get_current_admin)):
    return SuccessResponse(message="Available audit actions.", data=[value for value in AuditAction])


@router.get("/{entry_id}", response_model=SuccessResponse[AuditLogOut])
def get_audit_log(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    entry = audit_log_service.get(db, entry_id)
    if entry is None:
        raise AppException(
            message="Audit log entry not found.",
            status_code=404,
            error_code="AUDIT_LOG_NOT_FOUND",
        )
    return SuccessResponse(message="Audit log retrieved.", data=entry)


@router.delete("/{entry_id}", response_model=MessageResponse)
def delete_audit_log(
    entry_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    audit_log_service.delete(db, actor=admin, entry_id=entry_id)
    return MessageResponse(message="Audit log entry deleted.")