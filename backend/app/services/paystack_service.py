import hashlib
import hmac
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import AppException

PAYSTACK_DEFAULT_BASE_URL = "https://api.paystack.co"


class PaystackService:
    """Thin HTTP client over the Paystack REST API.

    Every raw Paystack HTTP call lives here. Business logic (wallet,
    withdrawal, webhook processing) consumes *verified* data returned by these
    methods and never touches the network itself. Test/live key selection is
    resolved here based on the environment; the secret key is never exposed
    outside this service.
    """

    def __init__(self) -> None:
        self.base_url = (settings.paystack_base_url or PAYSTACK_DEFAULT_BASE_URL).rstrip("/")
        self._client = httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0))

    # ------------------------------------------------------------------ keys

    @property
    def secret_key(self) -> str:
        return settings.paystack_secret_key

    @property
    def public_key(self) -> str:
        return settings.paystack_public_key

    @property
    def webhook_secret(self) -> str:
        return settings.paystack_webhook_secret or self.secret_key

    @property
    def is_configured(self) -> bool:
        return bool(self.secret_key)

    @property
    def is_test_mode(self) -> bool:
        return self.secret_key.startswith("sk_test_")

    # ------------------------------------------------------------- transport

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict | None = None,
        json: dict | None = None,
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise AppException(
                message="Paystack is not configured.",
                status_code=503,
                error_code="PAYSTACK_NOT_CONFIGURED",
            )
        try:
            response = self._client.request(
                method,
                f"{self.base_url}{path}",
                params=params,
                json=json,
                headers=self._headers(),
            )
        except httpx.HTTPError:
            raise AppException(
                message="Payment provider is unreachable. Try again shortly.",
                status_code=502,
                error_code="PAYSTACK_UNREACHABLE",
            )

        try:
            body = response.json()
        except ValueError:
            body = {}

        if response.status_code >= 400 or body.get("status") is False:
            raise AppException(
                message=body.get("message") or "Payment provider error.",
                status_code=502,
                error_code="PAYSTACK_ERROR",
            )
        return body.get("data") or body

    def verify_webhook(self, payload: bytes, signature: str | None) -> bool:
        """Verify the `x-paystack-signature` HMAC (SHA-512) over the raw body."""
        if not signature:
            return False
        secret = self.webhook_secret.encode()
        digest = hmac.new(secret, payload, hashlib.sha512).hexdigest()
        return hmac.compare_digest(digest, signature)

    # -------------------------------------------------------------- customer

    def create_customer(
        self,
        *,
        email: str,
        first_name: str,
        last_name: str,
        phone: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
        }
        if phone:
            payload["phone"] = phone
        return self._request("POST", "/customer", json=payload)

    def get_customer(self, customer_code: str) -> dict[str, Any]:
        return self._request("GET", f"/customer/{customer_code}")

    def customer_transactions(self, customer_code: str) -> dict[str, Any]:
        return self._request("GET", f"/customer/{customer_code}?perPage=5")

    # ------------------------------------------------------------ dedicated

    def create_dedicated_account(
        self,
        *,
        customer_code: str,
        preferred_bank: str | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
        phone: str | None = None,
        metadata: dict | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "customer": customer_code,
            "preferred_bank": preferred_bank or ("test-bank" if self.is_test_mode else "wema-bank"),
        }
        if first_name and last_name:
            payload["first_name"] = first_name
            payload["last_name"] = last_name
        if phone:
            payload["phone"] = phone
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", "/dedicated_account", json=payload)

    def assign_dedicated_account(self, *, dedicated_account_id: str, customer_code: str) -> dict[str, Any]:
        return self._request(
            "POST",
            "/dedicated_account/assign",
            json={"dedicated_account_id": dedicated_account_id, "customer": customer_code},
        )

    def fetch_dedicated_account(self, dedicated_account_id: str) -> dict[str, Any]:
        return self._request("GET", f"/dedicated_account/{dedicated_account_id}")

    def requery_dedicated_account(self, *, account_number: str, provider_slug: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"account_number": account_number}
        if provider_slug:
            payload["provider_slug"] = provider_slug
        return self._request("POST", "/dedicated_account/requery", json=payload)

    # ----------------------------------------------------------- bank lookup

    def list_banks(self) -> dict[str, Any]:
        return self._request("GET", "/bank")

    def resolve_bank(self, *, account_number: str, bank_code: str) -> dict[str, Any]:
        return self._request("GET", "/bank/resolve", params={"account_number": account_number, "bank_code": bank_code})

    def create_transfer_recipient(
        self,
        *,
        name: str,
        account_number: str,
        bank_code: str,
        currency: str = "NGN",
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/transferrecipient",
            json={
                "type": "nuban",
                "name": name,
                "account_number": account_number,
                "bank_code": bank_code,
                "currency": currency,
            },
        )

    # ---------------------------------------------------------- transactions

    def initialize_transaction(
        self,
        *,
        email: str,
        amount: int,
        reference: str,
        callback_url: str | None = None,
        metadata: dict | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "email": email,
            "amount": amount,
            "reference": reference,
        }
        if callback_url:
            payload["callback_url"] = callback_url
        if metadata:
            payload["metadata"] = metadata
        return self._request("POST", "/transaction/initialize", json=payload)

    def verify_transaction(self, reference: str) -> dict[str, Any]:
        return self._request("GET", f"/transaction/verify/{reference}")

    # -------------------------------------------------------------- transfers

    def initiate_transfer(
        self,
        *,
        amount: int,
        recipient_code: str,
        reference: str,
        reason: str = "",
        source: str = "balance",
        currency: str = "NGN",
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "source": source,
            "amount": amount,
            "recipient": recipient_code,
            "reference": reference,
            "reason": reason,
            "currency": currency,
        }
        return self._request("POST", "/transfer", json=payload)

    def fetch_transfer(self, transfer_code: str) -> dict[str, Any]:
        return self._request("GET", f"/transfer/{transfer_code}")

    def verify_transfer(self, reference: str) -> dict[str, Any]:
        return self._request("GET", f"/transfer/verify/{reference}")


paystack_service = PaystackService()