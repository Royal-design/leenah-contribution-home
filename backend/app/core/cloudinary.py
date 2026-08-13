from typing import BinaryIO

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import AppException

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _configured() -> bool:
    return bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret)


def validate_image(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise AppException(
            message="Profile photo must be a JPEG, PNG, WebP or GIF image.",
            status_code=400,
            error_code="INVALID_IMAGE_TYPE",
        )

    contents = file.file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise AppException(
            message="Profile photo must be 5MB or smaller.",
            status_code=400,
            error_code="IMAGE_TOO_LARGE",
        )
    file.file.seek(0)


def upload_image(file: BinaryIO, *, folder: str | None = None, public_id: str | None = None) -> dict:
    if not _configured():
        raise AppException(
            message="Image upload is not configured. Contact support.",
            status_code=400,
            error_code="UPLOAD_NOT_CONFIGURED",
        )

    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )

    options: dict = {"folder": folder or settings.cloudinary_profile_folder, "overwrite": True}
    if public_id:
        options["public_id"] = public_id

    try:
        result = cloudinary.uploader.upload(file, **options)
    except Exception as exc:
        raise AppException(
            message="Could not upload image. Please try again.",
            status_code=400,
            error_code="UPLOAD_FAILED",
        ) from exc

    return {
        "url": result.get("secure_url") or result.get("url"),
        "public_id": result.get("public_id"),
    }


def delete_image(public_id: str | None) -> None:
    if not public_id or not _configured():
        return

    import cloudinary.uploader

    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass