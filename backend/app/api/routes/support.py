import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.enums import SupportStatus
from app.models.user import User
from app.schemas.response import SuccessResponse
from app.schemas.support import (
    SupportMessageCreate,
    SupportStatusUpdate,
    SupportThreadCreate,
    SupportThreadDetail,
    SupportThreadOut,
    UnreadCount,
)
from app.services.support_service import support_service

router = APIRouter(tags=["Support"])


@router.post("/threads", response_model=SuccessResponse[SupportThreadDetail])
def create_thread(payload: SupportThreadCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = support_service.create_thread(
        db,
        user=user,
        subject=payload.subject,
        category=payload.category,
        message=payload.message,
    )
    return SuccessResponse(message="Message sent.", data=data)


@router.get("/threads")
def list_threads(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: SupportStatus | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    data = support_service.list_threads(
        db, user=user, status=status, search=search, page=page, page_size=page_size
    )
    return SuccessResponse(message="Threads retrieved.", data=data)


@router.get("/threads/unread-count", response_model=SuccessResponse[UnreadCount])
def unread_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return SuccessResponse(
        message="Unread threads count.",
        data=UnreadCount(unread_threads=support_service.unread_count(db, user=user)),
    )


@router.get("/threads/{thread_id}", response_model=SuccessResponse[SupportThreadDetail])
def get_thread(thread_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = support_service.get_thread(db, user=user, thread_id=thread_id)
    return SuccessResponse(message="Thread retrieved.", data=data)


@router.post("/threads/{thread_id}/messages", response_model=SuccessResponse[SupportThreadDetail])
def reply_thread(
    thread_id: uuid.UUID,
    payload: SupportMessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = support_service.reply(db, user=user, thread_id=thread_id, body=payload.body)
    return SuccessResponse(message="Reply sent.", data=data)


@router.patch("/threads/{thread_id}/status", response_model=SuccessResponse[SupportThreadOut])
def update_thread_status(
    thread_id: uuid.UUID,
    payload: SupportStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = support_service.set_status(db, user=user, thread_id=thread_id, status=payload.status)
    return SuccessResponse(message="Thread status updated.", data=data)