"""Tests for the contribution financial flow.

Run against the configured (dev) PostgreSQL database. Creates fresh users and
cleans them up afterwards; contributions are cascade-deleted with their
creator's user row.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.services.notification_service import notification_service

client = TestClient(app)


@pytest.fixture(autouse=True, scope="session")
def _disable_notifications():
    """Notifications fan out to every user in the DB (network-bound) — no-op for tests."""
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
    return f"ctest_{uuid.uuid4().hex[:10]}@lchtest.com"


def _register_client(email: str) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={
            "first_name": "Test",
            "last_name": "User",
            "email": email,
            "password": "StrongPass123!",
            "phone": "08011112222",
        },
    )
    return resp.json()["data"]["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token() -> str:
    email = _unique_email()
    token = _register_client(email)
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one()
        user.role = UserRole.ADMIN
        user.roles = [UserRole.ADMIN, UserRole.USER]
        db.commit()
    yield token
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one_or_none()
        if user:
            db.delete(user)
            db.commit()


@pytest.fixture(scope="module")
def users() -> tuple[dict, dict]:
    u1_email = _unique_email()
    u2_email = _unique_email()
    u1 = {"email": u1_email, "token": _register_client(u1_email)}
    u2 = {"email": u2_email, "token": _register_client(u2_email)}
    yield u1, u2
    with SessionLocal() as db:
        for email in (u1_email, u2_email):
            user = db.query(User).filter(User.email == email).one_or_none()
            if user:
                db.delete(user)
        db.commit()


def _create_contribution(admin_headers: dict, **overrides) -> dict:
    payload = {
        "name": f"Test Circle {uuid.uuid4().hex[:6]}",
        "description": "Test contribution plan",
        "amount": 20000,
        "frequency": "monthly",
        "member_count": 5,
        "rounds": 10,
        "start_date": "2026-09-01T00:00:00Z",
        "withdrawal_rule": "on_schedule",
    }
    payload.update(overrides)
    resp = client.post("/api/admin/contributions", headers=admin_headers, json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _fund(header: dict, amount: int) -> None:
    resp = client.post("/api/wallet/fund/mock", headers=header, json={"amount": amount})
    assert resp.status_code == 200, resp.text


def _join(header: dict, contribution_id: str) -> dict:
    resp = client.post(f"/api/contributions/{contribution_id}/join", headers=header)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _balance(header: dict) -> int:
    resp = client.get("/api/savings/account", headers=header)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["balance"]


def _get_contribution(header: dict, contribution_id: str) -> dict:
    resp = client.get(f"/api/contributions/{contribution_id}", headers=header)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


class TestContributionFinance:
    def test_join_moves_no_money(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        before = _balance(_headers(u1["token"]))
        joined = _join(_headers(u1["token"]), plan["id"])
        after = _balance(_headers(u1["token"]))
        assert after == before, "joining a contribution must not deduct money"
        assert joined["total_contributed"] == 0

    def test_schedules_generated_for_member(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000, rounds=10)
        u1, u2 = users
        joined = _join(_headers(u1["token"]), plan["id"])
        assert len(joined["schedule"]) == 10
        assert all(s["amount"] == 20000 for s in joined["schedule"])
        assert all(s["status"] == "upcoming" for s in joined["schedule"])
        first, *rest = joined["schedule"]
        assert first["label"] == "Round 1"
        assert rest[0]["due_date"] > first["due_date"], "due dates must advance"

    def test_rotational_payout_generated(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000, member_count=4, rounds=6)
        u1, u2 = users
        joined = _join(_headers(u1["token"]), plan["id"])
        assert len(joined["payouts"]) == 1
        payout = joined["payouts"][0]
        assert payout["amount"] == 20000 * 4
        assert payout["status"] == "pending"
        assert payout["round_number"] == 1  # first joiner

    def test_pay_wallet_decreases_and_marks_paid(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        joined = _join(_headers(u1["token"]), plan["id"])
        schedule_id = joined["schedule"][0]["id"]
        before = _balance(_headers(u1["token"]))

        resp = client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        assert resp.status_code == 200, resp.text
        after = _balance(_headers(u1["token"]))
        assert before - after == 20000

        detail = _get_contribution(_headers(u1["token"]), plan["id"])
        assert detail["schedule"][0]["status"] == "paid"
        assert detail["schedule"][0]["transaction_id"] is not None
        assert detail["total_contributed"] == 20000
        assert detail["members"][0]["total_contributed"] == 20000

    def test_total_expected_and_progress(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000, member_count=5, rounds=10)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        joined = _join(_headers(u1["token"]), plan["id"])
        expected = 20000 * 5 * 10
        detail = _get_contribution(_headers(u1["token"]), plan["id"])
        assert detail["total_expected"] == expected
        assert detail["progress"] == 0

        schedule_id = joined["schedule"][0]["id"]
        client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        detail = _get_contribution(_headers(u1["token"]), plan["id"])
        assert detail["total_expected"] == expected
        assert detail["total_contributed"] == 20000
        assert detail["progress"] == round(20000 / expected * 100)

    def test_insufficient_funds_no_deduction(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _join(_headers(u2["token"]), plan["id"])  # empty wallet
        before = _balance(_headers(u2["token"]))
        resp = client.post(
            f"/api/contributions/{plan['id']}/pay",
            headers=_headers(u2["token"]),
            json={"funding_method": "wallet"},
        )
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "INSUFFICIENT_FUNDS"
        assert _balance(_headers(u2["token"])) == before, "no money should move on failure"
        detail = _get_contribution(_headers(u2["token"]), plan["id"])
        assert detail["schedule"][0]["status"] == "upcoming"
        assert detail["schedule"][0]["failure_reason"] == "insufficient_funds"
        assert detail["schedule"][0]["attempt_count"] >= 1

    def test_duplicate_payment_no_double_deduction(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        joined = _join(_headers(u1["token"]), plan["id"])
        schedule_id = joined["schedule"][0]["id"]

        resp1 = client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        assert resp1.status_code == 200, resp1.text

        balance_after_first = _balance(_headers(u1["token"]))
        resp2 = client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        assert resp2.status_code == 400
        assert resp2.json()["error_code"] == "ALREADY_PAID"
        assert _balance(_headers(u1["token"])) == balance_after_first

        detail = _get_contribution(_headers(u1["token"]), plan["id"])
        assert detail["total_contributed"] == 20000

    def test_cannot_pay_another_users_schedule(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        joined_u1 = _join(_headers(u1["token"]), plan["id"])
        _join(_headers(u2["token"]), plan["id"])
        u1_schedule_id = joined_u1["schedule"][0]["id"]

        resp = client.post(
            f"/api/contributions/schedules/{u1_schedule_id}/pay",
            headers=_headers(u2["token"]),
            params={"contribution_id": plan["id"]},
        )
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "NO_DUE_PAYMENT"

    def test_cannot_join_same_contribution_twice(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers)
        u1, u2 = users
        _join(_headers(u1["token"]), plan["id"])
        resp = client.post(f"/api/contributions/{plan['id']}/join", headers=_headers(u1["token"]))
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "ALREADY_MEMBER"

    def test_contribution_capacity_respected(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, member_count=1)
        u1, u2 = users
        _join(_headers(u1["token"]), plan["id"])
        resp = client.post(f"/api/contributions/{plan['id']}/join", headers=_headers(u2["token"]))
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "CONTRIBUTION_FULL"

    def test_withdrawal_rule_respected(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(
            admin_headers,
            start_date="2026-12-01T00:00:00Z",
            withdrawal_rule="fixed_date",
            fixed_withdrawal_date="2027-06-01T00:00:00Z",
        )
        u1, u2 = users
        _join(_headers(u1["token"]), plan["id"])
        resp = client.post(
            "/api/withdrawals",
            headers=_headers(u1["token"]),
            json={
                "amount": 20000,
                "withdrawal_type": "contribution",
                "bank_name": "GTBank",
                "account_number": "0123456789",
                "account_name": "Test User",
                "destination": "0123456789 GTBAN",
                "contribution_id": plan["id"],
            },
        )
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "CONTRIBUTION_LOCKED"

    def test_contribution_transaction_recorded(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        joined = _join(_headers(u1["token"]), plan["id"])
        schedule_id = joined["schedule"][0]["id"]
        client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        resp = client.get("/api/transactions?type=contribution", headers=_headers(u1["token"]))
        assert resp.status_code == 200, resp.text
        items = resp.json()["data"]["items"]
        contribution_entries = [t for t in items if t["type"] == "contribution" and t["status"] == "successful"]
        assert any(t["amount"] == 20000 for t in contribution_entries)

    def test_history_preserved_after_leave(self, admin_token, users):
        admin_headers = _headers(admin_token)
        plan = _create_contribution(admin_headers, amount=20000)
        u1, u2 = users
        _fund(_headers(u1["token"]), 100000)
        _join(_headers(u1["token"]), plan["id"])
        detail = _get_contribution(_headers(u1["token"]), plan["id"])
        schedule_id = detail["schedule"][0]["id"]
        client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(u1["token"]),
            params={"contribution_id": plan["id"]},
        )
        leave = client.post(f"/api/contributions/{plan['id']}/leave", headers=_headers(u1["token"]))
        assert leave.status_code == 200, leave.text

        admin_detail = client.get(f"/api/admin/contributions/{plan['id']}", headers=admin_headers)
        assert admin_detail.status_code == 200, admin_detail.text
        data = admin_detail.json()["data"]
        assert data["total_contributed"] == 20000, "contribution totals must survive a member leaving"

    def test_user_cannot_create_contribution(self, admin_token, users):
        u1, u2 = users
        resp = client.post(
            "/api/contributions",
            headers=_headers(u2["token"]),
            json={
                "name": "Blocked",
                "amount": 5000,
                "frequency": "monthly",
                "member_count": 3,
                "rounds": 3,
                "start_date": "2026-09-01T00:00:00Z",
            },
        )
        assert resp.status_code == 403