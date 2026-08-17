"""Tests for the Paystack payment architecture.

Run against the configured (dev) PostgreSQL database like the existing suite.
The Paystack HTTP layer is faked by monkeypatching the module-level
`paystack_service` singleton, so no network calls are made. Webhook signature
verification uses the real HMAC secret so the handler is exercised end-to-end.
"""

import hashlib
import hmac
import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.exceptions import AppException
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.models.webhook_event import WebhookEvent
from app.services.paystack_service import paystack_service
from app.services.notification_service import notification_service

client = TestClient(app)

EVENTS_CTR = 0


def _unique_email() -> str:
    return f"pytest_{uuid.uuid4().hex[:10]}@lchtest.com"


def _wipe(email: str) -> None:
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.email == email).first()
        if db_user:
            db.delete(db_user)
        db.commit()


def _register() -> dict:
    email = _unique_email()
    resp = client.post(
        "/api/auth/register",
        json={
            "first_name": "Paystack",
            "last_name": "Tester",
            "email": email,
            "password": "StrongPass123!",
            "phone": "08012345678",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    return {"email": email, "token": data["access_token"]}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _balance(token: str) -> dict:
    resp = client.get("/api/savings/account", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _fund(token: str, amount: int) -> None:
    resp = client.post("/api/wallet/fund/mock", headers=_headers(token), json={"amount": amount})
    assert resp.status_code == 200, resp.text


def _sign(body: bytes) -> str:
    return hmac.new(settings.paystack_secret_key.encode(), body, hashlib.sha512).hexdigest()


def _webhook(event_type: str, data: dict, *, event_id: str | None = None):
    global EVENTS_CTR
    if event_id is None:
        event_id = f"evt_{EVENTS_CTR}"
        EVENTS_CTR += 1
    body = json.dumps({"event": event_type, "data": {**(data or {}), "id": event_id}}).encode()
    return client.post(
        "/webhooks/paystack",
        content=body,
        headers={"x-paystack-signature": _sign(body)},
    )


# --------------------------------------------------------------------- fakes


class _FakePaystack:
    """Canned Paystack responses. Individual tests override the dicts."""

    def __init__(self):
        self.create_customer_out = {"customer_code": f"CUS_{uuid.uuid4().hex[:8]}", "id": 12345}
        self.dva_out = {
            "id": 54321,
            "account_number": "8845761322",
            "account_name": "LCH / PAYSTACK TESTER",
            "bank": {"name": "Paystack-Titan", "slug": "titan-paystack"},
            "status": "pending",
        }
        self.resolve_out = {"bank_name": "GTBank", "account_name": "JOHN DOE"}
        self.recipient_out = {"recipient_code": "RCP_fake_123456"}
        self.init_out = {"authorization_url": "https://checkout.paystack.com/abc", "access_code": "access_fake"}
        self.transfer_out = {}
        self.requery_out = {}
        self.raise_error_on: set[str] = set()

    def _maybe_raise(self, method: str):
        if method in self.raise_error_on:
            raise AppException(message=f"{method} failed.", status_code=502, error_code="PAYSTACK_ERROR")

    def create_customer(self, **kwargs):
        self._maybe_raise("create_customer")
        return dict(self.create_customer_out)

    def get_customer(self, customer_code):
        return {"customer_code": customer_code, "id": 12345}

    def create_dedicated_account(self, **kwargs):
        self._maybe_raise("create_dedicated_account")
        out = dict(self.dva_out)
        out["account_number"] = str(1000000000 + uuid.uuid4().int % 9000000000)
        return out

    def assign_dedicated_account(self, **kwargs):
        self._maybe_raise("assign_dedicated_account")
        return {"assignment": {"status": "assigned"}, "customer": {"customer_code": kwargs["customer_code"]}}

    def requery_dedicated_account(self, **kwargs):
        self._maybe_raise("requery_dedicated_account")
        return dict(self.requery_out or self.dva_out)

    def resolve_bank(self, **kwargs):
        if "resolve_bank" in self.raise_error_on:
            raise AppException(message="Account number is invalid.", status_code=502, error_code="PAYSTACK_ERROR")
        return dict(self.resolve_out)

    def create_transfer_recipient(self, **kwargs):
        self._maybe_raise("create_transfer_recipient")
        return dict(self.recipient_out)

    def initialize_transaction(self, **kwargs):
        self._maybe_raise("initialize_transaction")
        out = dict(self.init_out)
        out["reference"] = kwargs["reference"]
        return out

    def verify_transaction(self, reference):
        self._maybe_raise("verify_transaction")
        return {"status": "success", "reference": reference, "amount": 100000, "currency": "NGN", "channel": "card"}

    def initiate_transfer(self, **kwargs):
        self._maybe_raise("initiate_transfer")
        out = dict(self.transfer_out)
        out.setdefault("transfer_code", f"TRF_{uuid.uuid4().hex[:10]}")
        return out


_FAKE_METHODS = (
    "create_customer",
    "get_customer",
    "create_dedicated_account",
    "assign_dedicated_account",
    "requery_dedicated_account",
    "resolve_bank",
    "create_transfer_recipient",
    "initialize_transaction",
    "verify_transaction",
    "initiate_transfer",
)


@pytest.fixture(autouse=True)
def _fake_paystack(monkeypatch):
    spoof = _FakePaystack()
    for method in _FAKE_METHODS:
        monkeypatch.setattr(paystack_service, method, getattr(spoof, method))
    return spoof


@pytest.fixture(autouse=True, scope="session")
def _clear_webhook_events():
    """webhook_events have no user FK, so stale rows from earlier runs would
    collide with the fixed event ids used below. Wipe them at session start."""
    with SessionLocal() as db:
        db.query(WebhookEvent).delete()
        db.commit()
    yield


@pytest.fixture(autouse=True, scope="session")
def _disable_notifications():
    originals = (
        notification_service.notify_all_users,
        notification_service.notify_admins,
        notification_service.create,
    )
    notification_service.notify_all_users = lambda *args, **kwargs: []
    notification_service.notify_admins = lambda *args, **kwargs: None
    notification_service.create = lambda *args, **kwargs: None
    yield
    (
        notification_service.notify_all_users,
        notification_service.notify_admins,
        notification_service.create,
    ) = originals


@pytest.fixture()
def user() -> dict:
    u = _register()
    yield u
    _wipe(u["email"])


@pytest.fixture(scope="module")
def admin_token() -> str:
    admin = _register()
    with SessionLocal() as db:
        db_user = db.query(User).filter(User.email == admin["email"]).one()
        db_user.role = UserRole.ADMIN
        db_user.roles = [UserRole.ADMIN, UserRole.USER]
        db.commit()
    yield admin["token"]
    _wipe(admin["email"])


# ---------------------------------------------------------------- bank tests


class TestBankAccounts:
    def test_valid_account_resolution(self, _fake_paystack, user):
        resp = client.post(
            "/api/bank-accounts/resolve",
            headers=_headers(user["token"]),
            json={"account_number": "0123456789", "bank_code": "058"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["verified"] is True
        assert data["account_name"] == "JOHN DOE"
        assert data["bank_name"] == "GTBank"
        assert data["masked_account_number"].endswith("6789")

    def test_invalid_account(self, _fake_paystack, user):
        _fake_paystack.raise_error_on.add("resolve_bank")
        resp = client.post(
            "/api/bank-accounts/resolve",
            headers=_headers(user["token"]),
            json={"account_number": "0000000000", "bank_code": "058"},
        )
        assert resp.status_code == 502
        assert resp.json()["error_code"] == "PAYSTACK_ERROR"

    def test_saving_verified_account(self, _fake_paystack, user):
        # Frontend sends a bogus account name — must be ignored in favour of
        # the server-resolved name, and a recipient must be created.
        resp = client.post(
            "/api/bank-accounts",
            headers=_headers(user["token"]),
            json={
                "bank_code": "058",
                "bank_name": "Fake Bank",
                "account_number": "0123456789",
                "account_name": "COMPLETELY FAKE",
                "is_default": True,
            },
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["is_verified"] is True
        assert data["account_name"] == "JOHN DOE"
        assert data["bank_name"] == "GTBank"
        assert data["provider_recipient_code"] == "RCP_fake_123456"

    def test_rejecting_unverified_account(self, _fake_paystack, user):
        _fake_paystack.raise_error_on.add("resolve_bank")
        resp = client.post(
            "/api/bank-accounts",
            headers=_headers(user["token"]),
            json={"bank_code": "058", "account_number": "0000000000"},
        )
        assert resp.status_code == 502
        list_resp = client.get("/api/bank-accounts", headers=_headers(user["token"]))
        assert list_resp.json()["data"] == []


# ---------------------------------------------------------------- DVA tests


def _create_dva(token: str) -> dict:
    resp = client.post("/api/wallet/dva/create", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["dva"]


class TestDVA:
    def test_customer_creation_and_assignment(self, _fake_paystack, user):
        dva = _create_dva(user["token"])
        assert dva["account_number"] and len(dva["account_number"]) == 10
        assert dva["status"] == "pending"

        with SessionLocal() as db:
            db_user = db.query(User).filter(User.email == user["email"]).one()
            assert db_user.paystack_customer_code == _fake_paystack.create_customer_out["customer_code"]

    def test_successful_dva_webhook(self, _fake_paystack, user):
        dva = _create_dva(user["token"])
        customer_code = _fake_paystack.create_customer_out["customer_code"]
        resp = _webhook(
            "dedicatedaccount.assign.success",
            {
                "account_number": dva["account_number"],
                "account_name": "LCH / PAYSTACK TESTER",
                "bank": {"name": "Paystack-Titan", "slug": "titan-paystack"},
                "customer": {"customer_code": customer_code, "email": user["email"]},
            },
            event_id="dva-assign-1",
        )
        assert resp.status_code == 200, resp.text

        resp2 = client.get("/api/wallet/dva", headers=_headers(user["token"]))
        assert resp2.status_code == 200
        assert resp2.json()["data"]["dva"]["status"] == "active"

    def test_duplicate_dva_webhook(self, _fake_paystack, user):
        dva = _create_dva(user["token"])
        customer_code = _fake_paystack.create_customer_out["customer_code"]
        payload = {"account_number": dva["account_number"], "customer": {"customer_code": customer_code}}
        assert _webhook("dedicatedaccount.assign.success", payload, event_id="dva-assign-dup").status_code == 200
        assert _webhook("dedicatedaccount.assign.success", payload, event_id="dva-assign-dup").status_code == 200
        resp = client.get("/api/wallet/dva", headers=_headers(user["token"]))
        assert resp.json()["data"]["dva"]["status"] == "active"

    def test_failed_dva_assignment(self, _fake_paystack, user):
        _fake_paystack.raise_error_on.add("assign_dedicated_account")
        _create_dva(user["token"])
        customer_code = _fake_paystack.create_customer_out["customer_code"]
        resp = _webhook(
            "dedicatedaccount.assign.failed",
            {"customer": {"customer_code": customer_code}, "message": "Could not assign"},
            event_id="dva-assign-fail",
        )
        assert resp.status_code == 200
        resp2 = client.get("/api/wallet/dva", headers=_headers(user["token"]))
        assert resp2.json()["data"]["dva"]["status"] == "failed"


# ---------------------------------------------------------------- card tests


class TestCardFunding:
    def test_initialize_payment(self, user):
        resp = client.post(
            "/api/wallet/fund/card/initialize",
            headers=_headers(user["token"]),
            json={"amount": 20000},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["authorization_url"].startswith("https://checkout.paystack.com")
        assert data["reference"]

        with SessionLocal() as db:
            from app.models.payment import Payment

            payment = db.query(Payment).filter(Payment.internal_reference == data["reference"]).first()
            assert payment is not None
            assert payment.status.value == "pending"

    def test_successful_payment_webhook(self, user):
        resp = client.post(
            "/api/wallet/fund/card/initialize",
            headers=_headers(user["token"]),
            json={"amount": 20000},
        )
        reference = resp.json()["data"]["reference"]
        before = _balance(user["token"])

        webhook_resp = _webhook(
            "charge.success",
            {
                "status": "success",
                "reference": reference,
                "amount": 20000 * 100,
                "currency": "NGN",
                "channel": "card",
                "customer": {"customer_code": "CUS_card", "email": user["email"]},
            },
            event_id="card-charge-1",
        )
        assert webhook_resp.status_code == 200, webhook_resp.text
        assert _balance(user["token"])["balance"] == before["balance"] + 20000

    def test_duplicate_webhook_no_double_credit(self, user):
        resp = client.post(
            "/api/wallet/fund/card/initialize",
            headers=_headers(user["token"]),
            json={"amount": 5000},
        )
        reference = resp.json()["data"]["reference"]
        payload = {
            "status": "success",
            "reference": reference,
            "amount": 5000 * 100,
            "currency": "NGN",
            "channel": "card",
            "customer": {"customer_code": "CUS_card", "email": user["email"]},
        }
        assert _webhook("charge.success", payload, event_id="card-dup").status_code == 200
        mid = _balance(user["token"])
        assert _webhook("charge.success", payload, event_id="card-dup").status_code == 200
        assert _balance(user["token"])["balance"] == mid["balance"]

    def test_failed_payment(self, user):
        resp = client.post(
            "/api/wallet/fund/card/initialize",
            headers=_headers(user["token"]),
            json={"amount": 3000},
        )
        reference = resp.json()["data"]["reference"]
        before = _balance(user["token"])
        assert _webhook(
            "charge.failed",
            {"reference": reference, "status": "failed"},
            event_id="card-fail",
        ).status_code == 200
        assert _balance(user["token"])["balance"] == before["balance"]

        with SessionLocal() as db:
            from app.models.payment import Payment

            payment = db.query(Payment).filter(Payment.provider_reference == reference).first()
            assert payment.status.value == "failed"


# ---------------------------------------------------------- withdrawal tests


@pytest.fixture()
def funded_user_with_bank(user):
    _fund(user["token"], 100000)
    resp = client.post(
        "/api/bank-accounts",
        headers=_headers(user["token"]),
        json={"bank_code": "058", "account_number": "0123456789"},
    )
    assert resp.status_code == 200, resp.text
    user["bank_account_id"] = resp.json()["data"]["id"]
    return user


def _reque_withdrawal(token: str, bank_account_id: str, amount: int):
    return client.post(
        "/api/withdrawals",
        headers=_headers(token),
        json={"amount": amount, "withdrawal_type": "savings", "bank_account_id": bank_account_id},
    )


def _last_withdrawal(token: str, status: str | None = None) -> dict:
    params = {"page_size": 1}
    if status:
        params["status"] = status
    resp = client.get("/api/withdrawals", headers=_headers(token), params=params)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["items"][0]


class TestWithdrawals:
    def test_valid_withdrawal_reserves_funds(self, funded_user_with_bank):
        u = funded_user_with_bank
        before = _balance(u["token"])
        resp = _reque_withdrawal(u["token"], u["bank_account_id"], 40000)
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["status"] == "pending"
        assert resp.json()["data"]["processing_message"] is not None

        after = _balance(u["token"])
        assert after["balance"] == before["balance"] - 40000
        assert after["reserved"] == before["reserved"] + 40000

    def test_insufficient_balance(self, funded_user_with_bank):
        u = funded_user_with_bank
        resp = _reque_withdrawal(u["token"], u["bank_account_id"], 9_000_000)
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INSUFFICIENT_BALANCE"

    def test_reserved_funds_not_spendable(self, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 40000)
        resp = _reque_withdrawal(u["token"], u["bank_account_id"], 70000)
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INSUFFICIENT_BALANCE"

    def test_admin_rejection_releases_funds(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 40000)
        wdl = _last_withdrawal(u["token"])
        before = _balance(u["token"])

        reject = client.post(
            f"/api/admin/withdrawals/{wdl['id']}/reject",
            headers=_headers(admin_token),
            json={"reason": "Insufficient documentation"},
        )
        assert reject.status_code == 200, reject.text
        assert reject.json()["data"]["status"] == "rejected"

        after = _balance(u["token"])
        assert after["balance"] == before["balance"] + 40000
        assert after["reserved"] == before["reserved"] - 40000

    def test_admin_approval_initiates_transfer(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])

        approve = client.post(
            f"/api/admin/withdrawals/{wdl['id']}/approve",
            headers=_headers(admin_token),
            json={},
        )
        assert approve.status_code == 200, approve.text
        data = approve.json()["data"]
        assert data["status"] == "processing"
        assert data["paystack_transfer_code"]
        assert data["paystack_reference"]

    def test_duplicate_approval_rejected(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])
        first = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        assert first.status_code == 200
        second = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        assert second.status_code == 400
        assert second.json()["error_code"] == "ALREADY_REVIEWED"

    def test_transfer_success_completes(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])
        approve = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        transfer_code = approve.json()["data"]["paystack_transfer_code"]
        reference = approve.json()["data"]["paystack_reference"]
        reserved_before = _balance(u["token"])["reserved"]

        resp = _webhook(
            "transfer.success",
            {"transfer_code": transfer_code, "reference": reference, "amount": 25000 * 100, "status": "success"},
            event_id="trf-success",
        )
        assert resp.status_code == 200, resp.text

        after = _balance(u["token"])
        assert after["reserved"] == reserved_before - 25000
        wdl = _last_withdrawal(u["token"])
        assert wdl["status"] == "completed"
        assert wdl["completed_at"] is not None

    def test_transfer_failed_releases_funds(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])
        approve = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        transfer_code = approve.json()["data"]["paystack_transfer_code"]
        reference = approve.json()["data"]["paystack_reference"]
        before = _balance(u["token"])

        resp = _webhook(
            "transfer.failed",
            {
                "transfer_code": transfer_code,
                "reference": reference,
                "amount": 25000 * 100,
                "status": "failed",
                "failure_reason": "Insufficient balance",
            },
            event_id="trf-failed",
        )
        assert resp.status_code == 200

        after = _balance(u["token"])
        assert after["balance"] == before["balance"] + 25000
        assert after["reserved"] == 0
        wdl = _last_withdrawal(u["token"])
        assert wdl["status"] == "failed"
        assert wdl["failure_reason"] == "Insufficient balance"

    def test_transfer_reversed_credits_back(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])
        approve = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        transfer_code = approve.json()["data"]["paystack_transfer_code"]
        reference = approve.json()["data"]["paystack_reference"]
        assert _webhook(
            "transfer.success",
            {"transfer_code": transfer_code, "reference": reference, "amount": 25000 * 100, "status": "success"},
            event_id="trf-success-r",
        ).status_code == 200
        after_success = _balance(u["token"])

        resp = _webhook(
            "transfer.reversed",
            {"transfer_code": transfer_code, "reference": reference, "amount": 25000 * 100, "status": "reversed"},
            event_id="trf-reversed",
        )
        assert resp.status_code == 200

        after = _balance(u["token"])
        assert after["balance"] == after_success["balance"] + 25000
        assert after["reserved"] == 0
        wdl = _last_withdrawal(u["token"])
        assert wdl["status"] == "reversed"

    def test_duplicate_transfer_webhook(self, admin_token, funded_user_with_bank):
        u = funded_user_with_bank
        _reque_withdrawal(u["token"], u["bank_account_id"], 25000)
        wdl = _last_withdrawal(u["token"])
        approve = client.post(f"/api/admin/withdrawals/{wdl['id']}/approve", headers=_headers(admin_token), json={})
        transfer_code = approve.json()["data"]["paystack_transfer_code"]
        payload = {"transfer_code": transfer_code, "amount": 25000 * 100, "status": "success"}
        assert _webhook("transfer.success", payload, event_id="trf-dup").status_code == 200
        mid = _balance(u["token"])
        assert _webhook("transfer.success", payload, event_id="trf-dup").status_code == 200
        assert _balance(u["token"])["reserved"] == mid["reserved"]
        assert _last_withdrawal(u["token"])["status"] == "completed"


# -------------------------------------------------------------- wallet tests


class TestWalletFlows:
    def test_dva_funding_increases_wallet(self, _fake_paystack, user):
        _create_dva(user["token"])
        customer_code = _fake_paystack.create_customer_out["customer_code"]
        before = _balance(user["token"])

        resp = _webhook(
            "charge.success",
            {
                "status": "success",
                "reference": f"DRF-{uuid.uuid4().hex[:10]}",
                "amount": 75000 * 100,
                "currency": "NGN",
                "channel": "dedicated_nuban",
                "dedicated_account": {"account_number": _fake_paystack.dva_out["account_number"]},
                "customer": {"customer_code": customer_code, "email": user["email"]},
            },
            event_id="dva-funding-1",
        )
        assert resp.status_code == 200, resp.text
        assert _balance(user["token"])["balance"] == before["balance"] + 75000

    def test_dva_funding_idempotent(self, _fake_paystack, user):
        _create_dva(user["token"])
        customer_code = _fake_paystack.create_customer_out["customer_code"]
        reference = f"DRF-{uuid.uuid4().hex[:10]}"
        payload = {
            "status": "success",
            "reference": reference,
            "amount": 75000 * 100,
            "currency": "NGN",
            "channel": "dedicated_nuban",
            "customer": {"customer_code": customer_code, "email": user["email"]},
        }
        assert _webhook("charge.success", payload, event_id="dva-fund-dup").status_code == 200
        mid = _balance(user["token"])
        assert _webhook("charge.success", payload, event_id="dva-fund-dup").status_code == 200
        assert _balance(user["token"])["balance"] == mid["balance"]

    def test_contribution_deducts_wallet(self, admin_token, user):
        _fund(user["token"], 100000)
        plan = client.post(
            "/api/admin/contributions",
            headers=_headers(admin_token),
            json={
                "name": f"Pytest Plan {uuid.uuid4().hex[:6]}",
                "amount": 20000,
                "frequency": "monthly",
                "member_count": 4,
                "rounds": 4,
                "start_date": "2026-09-01T00:00:00Z",
                "withdrawal_rule": "on_schedule",
            },
        )
        assert plan.status_code == 200, plan.text
        contribution_id = plan.json()["data"]["id"]

        join = client.post(f"/api/contributions/{contribution_id}/join", headers=_headers(user["token"]))
        assert join.status_code == 200, join.text
        schedule_id = join.json()["data"]["schedule"][0]["id"]

        before = _balance(user["token"])
        pay = client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(user["token"]),
            params={"contribution_id": contribution_id},
        )
        assert pay.status_code == 200, pay.text
        after = _balance(user["token"])
        assert before["balance"] - after["balance"] == 20000
