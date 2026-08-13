import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.notification import MarkReadResponse
from app.schemas.response import MessageResponse, SuccessResponse
from app.services.notification_service import notification_service

router = APIRouter(tags=["Notifications"])


@router.get("")
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = notification_service.list_for_user(db, user=user, page=page, page_size=page_size)
    return SuccessResponse(message="Notifications retrieved.", data=data)


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return SuccessResponse(message="Unread count.", data={"unread_count": notification_service.unread_count(db, user=user)})


@router.patch("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marked = notification_service.mark_all_read(db, user=user)
    return SuccessResponse(message="All notifications marked as read.", data=MarkReadResponse(marked=marked))


@router.patch("/{notification_id}/read")
def mark_read(notification_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notification_service.mark_read(db, user=user, notification_id=notification_id)
    return MessageResponse(message="Notification marked as read.")