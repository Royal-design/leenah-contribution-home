"""Tests for the commission + withdrawal + payout + emergency architecture.

Run against the configured (dev) PostgreSQL database like the existing suite.
Uses the mock funding hatch for wallet balances and the wallet/bank channels,
so no external provider calls are required for these flows.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.services.commission_service import compute_commission
from app.services.notification_service import notification_service

client = TestClient(app)


def _future_iso(days: int = 15) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")


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


def _unique_email() -> str:
    return f"fintest_{uuid.uuid4().hex[:10]}@lchtest.com"


def _register() -> dict:
    email = _unique_email()
    resp = client.post(
        "/api/auth/register",
        json={
            "first_name": "Fin",
            "last_name": "Test",
            "email": email,
            "password": "StrongPass123!",
            "phone": "08011112222",
        },
    )
    assert resp.status_code == 200, resp.text
    return {"email": email, "token": resp.json()["data"]["access_token"]}


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token() -> str:
    registered = _register()
    token = registered["token"]
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == registered["email"]).one()
        user.role = UserRole.ADMIN
        user.roles = [UserRole.ADMIN, UserRole.USER]
        db.commit()
    return token


def _fund(token: str, amount: int) -> None:
    resp = client.post("/api/wallet/fund/mock", headers=_headers(token), json={"amount": amount})
    assert resp.status_code == 200, resp.text


def _balance(token: str) -> dict:
    resp = client.get("/api/savings/account", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _set_commission(token: str, key: str, enabled: bool, type_: str, rate: float, fixed: int) -> None:
    defaults = {
        "wallet_withdrawal": {"enabled": key == "wallet_withdrawal" and enabled, "type": type_ if key == "wallet_withdrawal" else "percentage", "rate": rate if key == "wallet_withdrawal" else 0, "fixed": fixed if key == "wallet_withdrawal" else 0},
        "savings_withdrawal": {"enabled": key == "savings_withdrawal" and enabled, "type": type_ if key == "savings_withdrawal" else "percentage", "rate": rate if key == "savings_withdrawal" else 0, "fixed": fixed if key == "savings_withdrawal" else 0},
        "contribution_withdrawal": {"enabled": key == "contribution_withdrawal" and enabled, "type": type_ if key == "contribution_withdrawal" else "percentage", "rate": rate if key == "contribution_withdrawal" else 0, "fixed": fixed if key == "contribution_withdrawal" else 0},
        "contribution_payout": {"enabled": key == "contribution_payout" and enabled, "type": type_ if key == "contribution_payout" else "percentage", "rate": rate if key == "contribution_payout" else 0, "fixed": fixed if key == "contribution_payout" else 0},
        "emergency_withdrawal": {"enabled": key == "emergency_withdrawal" and enabled, "type": type_ if key == "emergency_withdrawal" else "percentage", "rate": rate if key == "emergency_withdrawal" else 0, "fixed": fixed if key == "emergency_withdrawal" else 0},
        "admin_payout": {"enabled": key == "admin_payout" and enabled, "type": type_ if key == "admin_payout" else "percentage", "rate": rate if key == "admin_payout" else 0, "fixed": fixed if key == "admin_payout" else 0},
    }
    resp = client.put(
        "/api/admin/settings/commissions",
        headers=_headers(token),
        json={"defaults": defaults},
    )
    assert resp.status_code == 200, resp.text


class TestCommissionMath:
    def test_percentage(self):
        out = compute_commission(amount=100000, type_="percentage", rate=2.0, fixed=None)
        assert out["commission"] == 2000
        assert out["net"] == 98000

    def test_fixed(self):
        out = compute_commission(amount=100000, type_="fixed", rate=0, fixed=500)
        assert out["commission"] == 500
        assert out["net"] == 99500

    def test_percentage_plus_fixed(self):
        out = compute_commission(amount=100000, type_="percentage_fixed", rate=2.0, fixed=100)
        assert out["commission"] == 2100
        assert out["net"] == 97900

    def test_no_commission(self):
        out = compute_commission(amount=100000, type_="percentage", rate=0, fixed=0)
        assert out["commission"] == 0
        assert out["net"] == 100000


class TestCommissionSettings:
    def test_update_and_get(self, admin_token):
        _set_commission(admin_token, "savings_withdrawal", True, "percentage", 3.0, 0)
        resp = client.get("/api/admin/settings/commissions", headers=_headers(admin_token))
        assert resp.status_code == 200
        data = resp.json()["data"]["defaults"]["savings_withdrawal"]
        assert data["enabled"] is True
        assert data["rate"] == 3.0
        # reset so the rest of the suite is unaffected
        _set_commission(admin_token, "savings_withdrawal", False, "percentage", 0, 0)


class TestSavingsPlanWithdrawal:
    def test_completed_plan_withdraw_to_wallet_with_commission(self, admin_token):
        _set_commission(admin_token, "savings_withdrawal", True, "percentage", 5.0, 0)
        user = _register()
        _fund(user["token"], 200000)

        resp = client.post(
            "/api/admin/savings-plans",
            headers=_headers(admin_token),
            json={
                "name": f"Fin Savings {uuid.uuid4().hex[:6]}",
                "amount": 10000,
                "frequency": "monthly",
                "start_date": _future_iso(),
                "end_date": (datetime.now(timezone.utc) + timedelta(days=45)).strftime("%Y-%m-%dT00:00:00Z"),
            },
        )
        assert resp.status_code == 200, resp.text
        plan = resp.json()["data"]

        join = client.post(f"/api/savings-plans/{plan['id']}/join", headers=_headers(user["token"]))
        assert join.status_code == 200, join.text
        schedule_id = join.json()["data"]["schedule"][0]["id"]

        pay = client.post(
            f"/api/savings-plans/{plan['id']}/pay",
            headers=_headers(user["token"]),
            json={"schedule_id": schedule_id},
        )
        assert pay.status_code == 200, pay.text
        plan_detail = client.get(f"/api/savings-plans/{plan['id']}", headers=_headers(user["token"])).json()["data"]
        assert plan_detail["status"] == "completed"
        assert plan_detail["withdrawable_amount"] == 10000

        before = _balance(user["token"])
        wd = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={
                "amount": 10000,
                "withdrawal_type": "savings",
                "channel": "wallet",
                "savings_plan_id": plan["id"],
            },
        )
        assert wd.status_code == 200, wd.text
        data = wd.json()["data"]
        assert data["source"] == "savings_plan"
        assert data["gross_amount"] == 10000
        assert data["commission_amount"] == 500
        assert data["net_amount"] == 9500

        # Not credited yet (pending admin approval).
        assert _balance(user["token"])["balance"] == before["balance"]

        approve = client.post(
            f"/api/admin/withdrawals/{data['id']}/approve",
            headers=_headers(admin_token),
            json={"reason": "Plan completed"},
        )
        assert approve.status_code == 200, approve.text
        assert approve.json()["data"]["status"] == "completed"

        after = _balance(user["token"])
        assert after["balance"] == before["balance"] + 9500

        txns = client.get("/api/transactions", headers=_headers(user["token"])).json()["data"]["items"]
        assert any(t["commission_amount"] == 500 and t["net_amount"] == 9500 for t in txns)

        _set_commission(admin_token, "savings_withdrawal", False, "percentage", 0, 0)

    def test_incomplete_plan_rejects_normal_withdrawal(self, admin_token):
        _set_commission(admin_token, "savings_withdrawal", False, "percentage", 0, 0)
        user = _register()
        _fund(user["token"], 200000)
        resp = client.post(
            "/api/admin/savings-plans",
            headers=_headers(admin_token),
            json={
                "name": f"Fin Savings {uuid.uuid4().hex[:6]}",
                "amount": 10000,
                "frequency": "monthly",
                "start_date": _future_iso(),
                "end_date": (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%dT00:00:00Z"),
            },
        )
        plan = resp.json()["data"]
        join = client.post(f"/api/savings-plans/{plan['id']}/join", headers=_headers(user["token"]))
        schedule_id = join.json()["data"]["schedule"][0]["id"]
        assert client.post(
            f"/api/savings-plans/{plan['id']}/pay",
            headers=_headers(user["token"]),
            json={"schedule_id": schedule_id},
        ).status_code == 200

        wd = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={"amount": 10000, "withdrawal_type": "savings", "channel": "wallet", "savings_plan_id": plan["id"]},
        )
        assert wd.status_code == 400
        assert wd.json()["error_code"] == "PLAN_NOT_COMPLETED"

    def test_cannot_duplicate_pending_request(self, admin_token):
        _set_commission(admin_token, "savings_withdrawal", False, "percentage", 0, 0)
        user = _register()
        _fund(user["token"], 50000)
        payload = {"amount": 10000, "withdrawal_type": "savings", "channel": "wallet"}
        first = client.post("/api/withdrawals", headers=_headers(user["token"]), json=payload)
        assert first.status_code == 200
        second = client.post("/api/withdrawals", headers=_headers(user["token"]), json=payload)
        assert second.status_code == 400
        assert second.json()["error_code"] == "DUPLICATE_WITHDRAWAL"


class TestEmergencyWithdrawal:
    def test_emergency_requires_reason_and_reject_releases(self, admin_token):
        user = _register()
        _fund(user["token"], 50000)

        missing = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={"amount": 10000, "withdrawal_type": "savings", "channel": "wallet", "source": "emergency"},
        )
        assert missing.status_code == 400
        assert missing.json()["error_code"] == "REASON_REQUIRED"

        req = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={
                "amount": 10000,
                "withdrawal_type": "savings",
                "channel": "wallet",
                "source": "emergency",
                "reason": "Emergency medical bill",
            },
        )
        assert req.status_code == 200, req.text
        wd = req.json()["data"]
        assert wd["source"] == "emergency"
        assert wd["reason"] == "Emergency medical bill"

        before = _balance(user["token"])
        reject = client.post(
            f"/api/admin/withdrawals/{wd['id']}/reject",
            headers=_headers(admin_token),
            json={"reason": "Documentation incomplete"},
        )
        assert reject.status_code == 200, reject.text
        assert reject.json()["data"]["status"] == "rejected"
        after = _balance(user["token"])
        assert after["balance"] == before["balance"] + 10000


class TestAdminPayout:
    def test_admin_payout_wallet_flow(self, admin_token):
        user = _register()
        with SessionLocal() as db:
            target = db.query(User).filter(User.email == user["email"]).one()
            user_id = str(target.id)
        _fund(user["token"], 50000)

        resp = client.post(
            "/api/admin/withdrawals",
            headers=_headers(admin_token),
            json={
                "user_id": user_id,
                "amount": 5000,
                "channel": "wallet",
                "reason": "Admin disbursement",
            },
        )
        assert resp.status_code == 200, resp.text
        wd = resp.json()["data"]
        assert wd["source"] == "admin"
        assert wd["admin_id"] is not None
        assert wd["status"] == "completed"

        txns = client.get(f"/api/admin/transactions?page_size=5", headers=_headers(admin_token)).json()["data"]["items"]
        assert any(t.get("related_withdrawal_id") == wd["id"] for t in txns)


class TestAuthorization:
    def test_user_cannot_approve(self, admin_token):
        user = _register()
        _fund(user["token"], 50000)
        req = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={"amount": 5000, "withdrawal_type": "savings", "channel": "wallet"},
        )
        wd = req.json()["data"]
        resp = client.post(
            f"/api/admin/withdrawals/{wd['id']}/approve",
            headers=_headers(user["token"]),
            json={},
        )
        assert resp.status_code == 403

    def test_commission_settings_admin_only(self):
        user = _register()
        resp = client.put(
            "/api/admin/settings/commissions",
            headers=_headers(user["token"]),
            json={"defaults": {}},
        )
        assert resp.status_code == 403


class TestPreview:
    def test_preview_returns_authoritative_breakdown(self, admin_token):
        _set_commission(admin_token, "wallet_withdrawal", True, "percentage", 5.0, 0)
        user = _register()
        resp = client.post(
            "/api/withdrawals/preview",
            headers=_headers(user["token"]),
            json={"amount": 10000, "withdrawal_type": "savings", "channel": "wallet"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["gross"] == 10000
        assert data["commission"] == 500
        assert data["net"] == 9500
        _set_commission(admin_token, "wallet_withdrawal", False, "percentage", 0, 0)

    def test_preview_amount_must_be_positive(self, admin_token):
        user = _register()
        resp = client.post(
            "/api/withdrawals/preview",
            headers=_headers(user["token"]),
            json={"amount": 0, "withdrawal_type": "savings"},
        )
        assert resp.status_code == 422


class TestContributionEmergency:
    def test_emergency_contribution_advance_consumes_payout(self, admin_token):
        # round 1 requires both members to pay; only one member pays.
        user = _register()
        with SessionLocal() as db:
            target = db.query(User).filter(User.email == user["email"]).one()
            user_id = str(target.id)
        other = _register()
        _fund(user["token"], 100000)
        _fund(other["token"], 100000)

        plan = client.post(
            "/api/admin/contributions",
            headers=_headers(admin_token),
            json={
                "name": f"Fin Contribution {uuid.uuid4().hex[:6]}",
                "amount": 20000,
                "frequency": "monthly",
                "member_count": 2,
                "rounds": 2,
                "start_date": _future_iso(),
                "withdrawal_rule": "on_schedule",
            },
        )
        assert plan.status_code == 200, plan.text
        contribution_id = plan.json()["data"]["id"]

        joined = client.post(
            f"/api/contributions/{contribution_id}/join", headers=_headers(user["token"])
        ).json()["data"]
        client.post(f"/api/contributions/{contribution_id}/join", headers=_headers(other["token"]))
        schedule_id = joined["schedule"][0]["id"]
        assert client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(user["token"]),
            params={"contribution_id": contribution_id},
        ).status_code == 200

        before = _balance(user["token"])
        req = client.post(
            "/api/withdrawals",
            headers=_headers(user["token"]),
            json={
                "amount": 15000,
                "withdrawal_type": "contribution",
                "channel": "wallet",
                "source": "emergency",
                "reason": "Medical emergency",
                "contribution_id": contribution_id,
            },
        )
        assert req.status_code == 200, req.text
        wd = req.json()["data"]
        assert wd["source"] == "emergency"

        approve = client.post(
            f"/api/admin/withdrawals/{wd['id']}/approve",
            headers=_headers(admin_token),
            json={"reason": "Exception granted"},
        )
        assert approve.status_code == 200, approve.text
        assert approve.json()["data"]["status"] == "completed"

        after = _balance(user["token"])
        assert after["balance"] == before["balance"] + 15000

        # The member's rotational payout entitlement was reduced by the advance.
        detail = client.get(
            f"/api/contributions/{contribution_id}", headers=_headers(user["token"])
        ).json()["data"]
        my_payout = next(
            p for p in detail["payouts"] if p["member_id"] == joined["members"][0]["id"]
        )
        assert my_payout["amount"] == 40000 - 15000