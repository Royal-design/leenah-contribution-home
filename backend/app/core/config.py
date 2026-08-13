from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Database
    database_url: str

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Cloudinary
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str
    cloudinary_profile_folder: str = "lch/avatars"

    # Google OAuth
    google_client_id: str
    google_client_secret: str

    # Paystack (integrated later)
    paystack_secret_key: str = ""
    paystack_public_key: str = ""

    # Email
    mail_username: str = ""
    mail_password: str = ""
    mail_port: int = 587
    mail_server: str = ""
    mail_from_name: str = "LCH"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False

    # Resend Email
    resend_api_key: str = ""
    mail_from: str = "LCH <onboarding@resend.dev>"

    # Frontend
    frontend_url: str = "http://localhost:3000"
    cors_allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore",
    )

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()