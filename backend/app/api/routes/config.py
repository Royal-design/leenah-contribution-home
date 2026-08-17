from fastapi import APIRouter

from app.schemas.response import SuccessResponse
from app.services.paystack_service import paystack_service

router = APIRouter(tags=["Config"])


@router.get("/paystack")
def paystack_config():
    """Frontend-safe provider config — public key only, never the secret."""
    return SuccessResponse(
        message="Paystack configuration.",
        data={"public_key": paystack_service.public_key, "configured": paystack_service.is_configured},
    )
