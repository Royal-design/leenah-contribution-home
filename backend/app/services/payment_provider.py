from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings
from app.services.paystack_service import paystack_service


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


class PaystackPaymentProvider(PaymentProvider):
    """Real Paystack provider used once PAYSTACK_SECRET_KEY is configured.

    Every method delegates to `paystack_service`, which owns the raw HTTP
    calls and key handling. This class only adapts the generic ABC contract.
    """

    name = "paystack"

    def initialize_payment(self, *, amount: int, email: str, reference: str, **kwargs) -> dict[str, Any]:
        data = paystack_service.initialize_transaction(
            email=email,
            amount=amount,
            reference=reference,
            callback_url=kwargs.get("callback_url"),
            metadata=kwargs.get("metadata"),
        )
        return {
            "provider": self.name,
            "status": True,
            "reference": reference,
            "amount": amount,
            "authorization_url": data.get("authorization_url"),
            "access_code": data.get("access_code"),
        }

    def verify_payment(self, reference: str) -> dict[str, Any]:
        data = paystack_service.verify_transaction(reference)
        return {
            "provider": self.name,
            "status": data.get("status"),
            "reference": reference,
            "verified": True,
            "data": data,
        }

    def charge_authorization(self, *, authorization_code: str, amount: int, email: str, reference: str) -> dict[str, Any]:
        raise NotImplementedError("Charge with authorization is handled through initialize/verify transactions.")

    def create_recipient(self, *, bank_code: str, account_number: str, account_name: str) -> dict[str, Any]:
        data = paystack_service.create_transfer_recipient(
            name=account_name,
            account_number=account_number,
            bank_code=bank_code,
        )
        return {
            "provider": self.name,
            "status": True,
            "recipient_code": data.get("recipient_code"),
            "bank_code": bank_code,
            "account_number": account_number,
            "account_name": data.get("name"),
        }

    def transfer(self, *, recipient_code: str, amount: int, reference: str, reason: str) -> dict[str, Any]:
        data = paystack_service.initiate_transfer(
            amount=amount,
            recipient_code=recipient_code,
            reference=reference,
            reason=reason,
        )
        return {
            "provider": self.name,
            "status": True,
            "reference": reference,
            "amount": amount,
            "recipient_code": recipient_code,
            "reason": reason,
            "transfer_code": data.get("transfer_code"),
        }


def get_payment_provider() -> PaymentProvider:
    """Returns the active provider.

    Paystack is used whenever a secret key is configured (including test keys
    in development). Falls back to the mock provider only when no key exists,
    e.g. isolated unit tests.
    """
    if paystack_service.is_configured:
        return PaystackPaymentProvider()
    return MockPaymentProvider()


payment_provider = get_payment_provider()