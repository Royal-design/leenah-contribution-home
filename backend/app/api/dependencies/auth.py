import uuid

from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppException
from app.core.security import decode_token
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_bearer_token(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    return credentials.credentials


def get_current_user(
    token: str = Depends(get_bearer_token),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)

    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (AttributeError, TypeError, ValueError):
        raise AppException(message="Invalid authentication credentials.", status_code=401, error_code="INVALID_TOKEN")

    user = db.get(User, user_id)
    if user is None:
        raise AppException(message="User account no longer exists.", status_code=401, error_code="INVALID_TOKEN")

    if not user.is_active:
        raise AppException(message="This account has been disabled.", status_code=403, error_code="ACCOUNT_DISABLED")

    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise AppException(message="You do not have permission to perform this action.", status_code=403, error_code="FORBIDDEN")
    return current_user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None

    try:
        payload = decode_token(credentials.credentials)
        user_id = uuid.UUID(str(payload.get("sub")))
    except (AppException, AttributeError, TypeError, ValueError):
        return None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None

    return user