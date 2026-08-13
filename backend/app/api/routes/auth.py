from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
)
from app.schemas.response import MessageResponse, SuccessResponse
from app.schemas.user import UserOut
from app.services.auth_service import auth_service

router = APIRouter(tags=["Auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    return request.headers.get("user-agent"), request.client.host if request.client else None


@router.post("/register", response_model=SuccessResponse[AuthResponse])
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    user_agent, ip = _client_meta(request)
    result = auth_service.register(
        db,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        password=payload.password,
        phone=payload.phone,
        user_agent=user_agent,
        ip_address=ip,
    )
    return SuccessResponse(message="Account created.", data=result)


@router.post("/login", response_model=SuccessResponse[AuthResponse])
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user_agent, ip = _client_meta(request)
    result = auth_service.login(
        db,
        email=payload.email,
        password=payload.password,
        user_agent=user_agent,
        ip_address=ip,
    )
    return SuccessResponse(message="Signed in.", data=result)


@router.post("/google", response_model=SuccessResponse[AuthResponse])
def google_login(payload: GoogleLoginRequest, request: Request, db: Session = Depends(get_db)):
    user_agent, ip = _client_meta(request)
    result = auth_service.google_login(db, access_token=payload.access_token, user_agent=user_agent, ip_address=ip)
    return SuccessResponse(message="Signed in with Google.", data=result)


@router.post("/refresh", response_model=SuccessResponse[TokenResponse])
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    user_agent, ip = _client_meta(request)
    result = auth_service.refresh(db, refresh_token=payload.refresh_token, user_agent=user_agent, ip_address=ip)
    return SuccessResponse(message="Tokens refreshed.", data=result)


@router.post("/logout", response_model=MessageResponse)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.logout(db, refresh_token=payload.refresh_token)
    return MessageResponse(message="Signed out.")


@router.post("/password-reset/request", response_model=MessageResponse)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    auth_service.request_password_reset(db, email=payload.email)
    return MessageResponse(message="If the email exists, a reset link has been sent.")


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    auth_service.reset_password(db, token=payload.token, new_password=payload.new_password)
    return MessageResponse(message="Password reset.")


@router.get("/me", response_model=SuccessResponse[UserOut])
def me(user: User = Depends(get_current_user)):
    return SuccessResponse(message="Profile retrieved.", data=UserOut.model_validate(user))


@router.patch("/me", response_model=SuccessResponse[UserOut])
def update_me(payload: UpdateProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = auth_service.update_profile(db, user=user, payload=payload)
    return SuccessResponse(message="Profile updated.", data=UserOut.model_validate(updated))


@router.patch("/me/password", response_model=MessageResponse)
def change_password(payload: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    auth_service.change_password(
        db,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return MessageResponse(message="Password changed.")


@router.delete("/me", response_model=MessageResponse)
def delete_me(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _, ip = _client_meta(request)
    auth_service.delete_account(db, user=user, ip_address=ip)
    return MessageResponse(message="Account deleted.")