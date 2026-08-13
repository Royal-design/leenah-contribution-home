import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def create(
        self,
        db: Session,
        *,
        token_jti: str,
        user_id: uuid.UUID,
        expires_at,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> RefreshToken:
        token = RefreshToken(
            token_jti=token_jti,
            user_id=user_id,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(token)
        db.flush()
        return token

    def get_active(self, db: Session, token_jti: str) -> RefreshToken | None:
        return db.execute(
            select(RefreshToken).where(RefreshToken.token_jti == token_jti, RefreshToken.revoked.is_(False))
        ).scalar_one_or_none()

    def revoke(self, db: Session, token: RefreshToken) -> None:
        token.revoked = True
        db.flush()


refresh_token_repository = RefreshTokenRepository()