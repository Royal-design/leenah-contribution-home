from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings


class PaymentProvider(ABC):
    """Abstraction over external payment providers (Paystack, etc.).

    Contribution/Wallet/Withdrawal business logic must never import a concrete
    provider. They receive *verified* financial events instead.
    """

    name = "generic"

    @abstractmethod
    def initialize_payment(self, *, amount: int, email: str, reference: str, **kwargs) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def verify_payment(self, reference: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def charge_authorization(self, *, authorization_code: str, amount: int, email: str, reference: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def create_recipient(self, *, bank_code: str, account_number: str, account_name: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def transfer(self, *, recipient_code: str, amount: int, reference: str, reason: str) -> dict[str, Any]:
        raise NotImplementedError


class MockPaymentProvider(PaymentProvider):
    """Development-only provider used before Paystack is wired in."""

    name = "mock"

    def initialize_payment(self, *, amount: int, email: str, reference: str, **kwargs) -> dict[str, Any]:
        return {
            "provider": self.name,
            "status": True,
            "reference": reference,
            "amount": amount,
            "authorization_url": f"https://pay.local/mock/{reference}",
        }

    def verify_payment(self, reference: str) -> dict[str, Any]:
        return {"provider": self.name, "status": True, "reference": reference, "verified": True}

    def charge_authorization(self, *, authorization_code: str, amount: int, email: str, reference: str) -> dict[str, Any]:
        return {
            "provider": self.name,
            "status": True,
            "reference": reference,
            "amount": amount,
            "authorization_code": authorization_code,
        }

    def create_recipient(self, *, bank_code: str, account_number: str, account_name: str) -> dict[str, Any]:
        return {
            "provider": self.name,
            "status": True,
            "recipient_code": f"RCP_MOCK_{account_number}",
            "bank_code": bank_code,
            "account_number": account_number,
            "account_name": account_name,
        }

    def transfer(self, *, recipient_code: str, amount: int, reference: str, reason: str) -> dict[str, Any]:
        return {
            "provider": self.name,
            "status": True,
            "reference": reference,
            "amount": amount,
            "recipient_code": recipient_code,
            "reason": reason,
        }


def get_payment_provider() -> PaymentProvider:
    """Returns the active provider.

    Switch to PaystackPaymentProvider here once Paystack is integrated,
    without touching contribution/wallet/withdrawal business logic.
    """
    if settings.paystack_secret_key and settings.environment != "development":
        # Placeholder for PaystackPaymentProvider — not implemented yet.
        pass
    return MockPaymentProvider()


payment_provider = get_payment_provider()