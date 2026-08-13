import uuid

from fastapi import APIRouter, Depends, File, UploadFile

from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.cloudinary import validate_image
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.user import User
from app.schemas.auth import UpdateProfileRequest
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.user import UserOut
from app.services.auth_service import auth_service
from app.services.user_service import user_service
from app.repositories.user_repository import user_repository

router = APIRouter(tags=["Users"])


@router.get("/me", response_model=SuccessResponse[UserOut])
def get_my_profile(user: User = Depends(get_current_user)):
    return SuccessResponse(message="Profile retrieved.", data=UserOut.model_validate(user))


@router.patch("/me", response_model=SuccessResponse[UserOut])
def update_my_profile(payload: UpdateProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = auth_service.update_profile(db, user=user, payload=payload)
    return SuccessResponse(message="Profile updated.", data=UserOut.model_validate(updated))


@router.post("/me/avatar", response_model=SuccessResponse[UserOut])
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file is None or not file.filename:
        raise AppException(message="No image provided.", status_code=400, error_code="NO_IMAGE")
    validate_image(file)
    updated = user_service.update_avatar(db, user=user, file=file)
    return SuccessResponse(message="Profile photo updated.", data=UserOut.model_validate(updated))


@router.delete("/me/avatar", response_model=SuccessResponse[UserOut])
def remove_avatar(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = user_service.remove_avatar(db, user=user)
    return SuccessResponse(message="Profile photo removed.", data=UserOut.model_validate(updated))


@router.get("/{user_id}", response_model=SuccessResponse[UserOut])
def get_public_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    user = user_repository.get(db, user_id)
    if user is None or not user.is_active:
        raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")
    return SuccessResponse(message="User retrieved.", data=UserOut.model_validate(user))