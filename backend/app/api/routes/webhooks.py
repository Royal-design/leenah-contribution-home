import json

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import AppException
from app.services.paystack_service import paystack_service
from app.services.webhook_service import webhook_service

router = APIRouter(tags=["Webhooks"])


@router.post("")
async def paystack_webhook(request: Request, db: Session = Depends(get_db)):
    """Secure Paystack webhook receiver.

    Paystack signs the raw request body with its secret key using HMAC-SHA512
    in the `x-paystack-signature` header. We verify before doing anything, then
    process the event atomically and idempotently. The response returns
    immediately regardless of outcome so Paystack never holds the connection.
    """
    raw = await request.body()
    signature = request.headers.get("x-paystack-signature")

    if not settings.paystack_skip_webhook_verification and not paystack_service.verify_webhook(raw, signature):
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid signature."})

    try:
        payload = json.loads(raw)
    except ValueError:
        return JSONResponse(status_code=400, content={"success": False, "message": "Invalid JSON body."})

    try:
        webhook_service.handle_event(db, payload=payload)
    except AppException as exc:
        # Unattributed payments are retried by Paystack; do not fail the
        # webhook. Roll back any partial writes so nothing half-processed is
        # committed.
        db.rollback()
        return JSONResponse(status_code=200, content={"success": True, "received": True, "note": exc.message})

    return JSONResponse(content={"success": True, "received": True})
