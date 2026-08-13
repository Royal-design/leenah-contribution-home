import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(*, to: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
        logger.warning("Resend API key not configured; skipping email to %s", to)
        return False

    try:
        import resend

        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.mail_from,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except Exception as exc:  # pragma: no cover - depends on external service
        logger.exception("Failed to send email to %s: %s", to, exc)
        return False


def send_password_reset_email(to: str, token: str) -> bool:
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    return send_email(
        to=to,
        subject="Reset your LCH password",
        html=f"""
        <p>Hi,</p>
        <p>We received a request to reset your LCH password.</p>
        <p><a href="{reset_url}">Reset your password</a></p>
        <p>This link is valid for 30 minutes. If you did not request this, you can safely ignore this email.</p>
        """,
    )