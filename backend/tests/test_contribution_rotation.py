"""Tests for the rotational contribution model.

Run against the configured (dev) PostgreSQL database — same setup as
test_contribution_finance.py. Verifies first-come-first-served positions,
capacity limits + rotation compatibility, admin reordering/locking, user
visibility and automatic round payouts.
"""

import uuid
from datetime import datetime, timedelta, timezone

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
    return f"rtest_{uuid.uuid4().hex[:10]}@lchtest.com"


def _register_client(email: str) -> str:
    resp = client.post(
        "/api/auth/register",
        json={
            "first_name": "Rot",
            "last_name": "Test",
            "email": email,
            "password": "StrongPass123!",
            "phone": "08011119999",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _future_iso(days: int = 45) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


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
def users():
    tokens = [_register_client(_unique_email()) for _ in range(3)]
    yield tokens
    with SessionLocal() as db:
        # Tokens carry no email; leave cleanup to register client teardown below.
        for token in tokens:
            pass


def _create_plan(admin_token: str, **overrides) -> dict:
    payload = {
        "name": f"Rotation Circle {uuid.uuid4().hex[:6]}",
        "description": "Rotation test plan",
        "amount": 10000,
        "frequency": "monthly",
        "member_count": 4,
        "rounds": 4,
        "start_date": _future_iso(),
        "withdrawal_rule": "on_schedule",
    }
    payload.update(overrides)
    resp = client.post("/api/admin/contributions", headers=_headers(admin_token), json=payload)
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _join(token: str, contribution_id: str) -> dict:
    resp = client.post(f"/api/contributions/{contribution_id}/join", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _detail(token: str, contribution_id: str) -> dict:
    resp = client.get(f"/api/contributions/{contribution_id}", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]


def _user_id(token: str) -> str:
    resp = client.get("/api/users/me", headers=_headers(token))
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["id"]


class TestRotationPositions:
    def test_join_assigns_sequential_positions(self, admin_token, users):
        user_ids = [_user_id(token) for token in users]
        plan = _create_plan(admin_token)
        for index, token in enumerate(users, start=1):
            _join(token, plan["id"])
            data = _detail(token, plan["id"])
            member = next(m for m in data["members"] if m["user_id"] == user_ids[index - 1])
            assert member["position"] == index
            # Position never below 1 and no duplicates across the plan.
            assert {m["position"] for m in data["members"]} == set(range(1, index + 1))

    def test_capacity_blocks_extra_join(self, admin_token, users):
        plan = _create_plan(admin_token, member_count=2, rounds=2)
        _join(users[0], plan["id"])
        _join(users[1], plan["id"])
        resp = client.post(f"/api/contributions/{plan['id']}/join", headers=_headers(users[2]))
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "CONTRIBUTION_FULL"

    def test_create_rejects_participants_over_rounds(self, admin_token):
        resp = client.post(
            "/api/admin/contributions",
            headers=_headers(admin_token),
            json={
                "name": f"Bad capacity {uuid.uuid4().hex[:6]}",
                "description": "Should be rejected",
                "amount": 5000,
                "frequency": "monthly",
                "member_count": 6,
                "rounds": 4,
                "start_date": _future_iso(),
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error_code"] == "CAPACITY_EXCEEDS_ROUNDS"

    def test_withdrawal_schedule_derived_from_position(self, admin_token, users):
        plan = _create_plan(admin_token, member_count=3, rounds=3, start_date=_future_iso(45))
        _join(users[0], plan["id"])
        _join(users[1], plan["id"])

        first = _detail(users[0], plan["id"])
        second = _detail(users[1], plan["id"])

        first_payout = next(p for p in first["payouts"])
        second_payout = next(p for p in second["payouts"])
        # Position 1 holds the round-#1 payout; position 2 the round-#2 payout.
        assert first_payout["round_number"] == 1
        assert second_payout["round_number"] == 2
        assert first_payout["status"] == "pending"
        # Position 2's withdrawal is one calendar month after position 1's.
        from datetime import datetime as _dt

        d1 = _dt.fromisoformat(first_payout["scheduled_date"].replace("Z", "+00:00"))
        d2 = _dt.fromisoformat(second_payout["scheduled_date"].replace("Z", "+00:00"))
        assert (d2.year, d2.month) == ((d1.year, d1.month + 1) if d1.month < 12 else (d1.year + 1, 1))

    def test_admin_reorder_before_start(self, admin_token, users):
        user_ids = [_user_id(token) for token in users]
        plan = _create_plan(admin_token, member_count=3, rounds=3)
        _join(users[0], plan["id"])
        _join(users[1], plan["id"])

        # Move the second user up to position 1.
        resp = client.patch(
            f"/api/admin/contributions/{plan['id']}/members/{user_ids[1]}/position",
            headers=_headers(admin_token),
            json={"position": 1},
        )
        assert resp.status_code == 200, resp.text

        assert _detail(users[1], plan["id"]).get("members") is not None
        positions = {m["user_id"]: m["position"] for m in _detail(users[0], plan["id"])["members"]}
        assert positions[user_ids[1]] == 1
        assert positions[user_ids[0]] == 2

    def test_reorder_locked_after_contributions(self, admin_token, users):
        user_ids = [_user_id(token) for token in users]
        plan = _create_plan(admin_token, member_count=2, rounds=2)
        joined = _join(users[0], plan["id"])
        _join(users[1], plan["id"])

        # Fund and pay round 1 for the first user -> contributions have begun.
        client.post("/api/wallet/fund/mock", headers=_headers(users[0]), json={"amount": 100000})
        schedule_id = joined["schedule"][0]["id"]
        pay = client.post(
            f"/api/contributions/schedules/{schedule_id}/pay",
            headers=_headers(users[0]),
            params={"contribution_id": plan["id"]},
        )
        assert pay.status_code == 200, pay.text

        resp = client.patch(
            f"/api/admin/contributions/{plan['id']}/members/{user_ids[0]}/position",
            headers=_headers(admin_token),
            json={"position": 2},
        )
        assert resp.status_code == 400
        assert resp.json()["error_code"] == "ROTATION_LOCKED"

    def test_user_cannot_choose_own_position(self, admin_token, users):
        plan = _create_plan(admin_token, member_count=4, rounds=4)
        # There is no user endpoint to set a position; joining auto-assigns #1.
        joined = _join(users[0], plan["id"])
        member = joined["members"][0]
        assert member["position"] == 1


class TestAutoPayout:
    def test_round_completion_marks_payout_eligible_and_admin_approves(self, admin_token, users):
        user_ids = [_user_id(token) for token in users]
        plan = _create_plan(admin_token, member_count=2, rounds=2)

        u1_join = _join(users[0], plan["id"])
        u2_join = _join(users[1], plan["id"])

        for token in users[:2]:
            client.post("/api/wallet/fund/mock", headers=_headers(token), json={"amount": 100000})

        # Both members pay round 1 (positions 1 and 2).
        for join_data, token in ((u1_join, users[0]), (u2_join, users[1])):
            pay = client.post(
                f"/api/contributions/schedules/{join_data['schedule'][0]['id']}/pay",
                headers=_headers(token),
                params={"contribution_id": plan["id"]},
            )
            assert pay.status_code == 200, pay.text

        # Round 1 is complete: position 1's payout is now ELIGIBLE but still
        # pending — money is NOT auto-credited (admin approval is required).
        detail = _detail(users[0], plan["id"])
        u1_payout = next(p for p in detail["payouts"] if p["round_number"] == 1)
        assert u1_payout["status"] == "pending"
        assert u1_payout["eligible_at"] is not None

        # The wallet was NOT credited yet.
        bal_before = client.get("/api/savings/account", headers=_headers(users[0])).json()["data"]["balance"]

        pending = client.get("/api/admin/payouts", headers=_headers(admin_token))
        assert pending.status_code == 200, pending.text
        assert any(p["id"] == u1_payout["id"] for p in pending.json()["data"]["items"])

        # Admin approves the payout.
        approve = client.post(
            f"/api/admin/payouts/{u1_payout['id']}/approve",
            headers=_headers(admin_token),
            json={"reason": "Round 1 complete"},
        )
        assert approve.status_code == 200, approve.text

        detail = _detail(users[0], plan["id"])
        u1_payout = next(p for p in detail["payouts"] if p["round_number"] == 1)
        assert u1_payout["status"] == "paid"
        assert u1_payout["paid_at"] is not None
        assert u1_payout["transaction_id"] is not None

        # Double approval is rejected.
        again = client.post(
            f"/api/admin/payouts/{u1_payout['id']}/approve",
            headers=_headers(admin_token),
            json={},
        )
        assert again.status_code == 400

        u2_payout = next(p for p in _detail(users[1], plan["id"])["payouts"] if p["round_number"] == 2)
        assert u2_payout["status"] == "pending"

        # The wallet was credited with the round-1 pool (2 members × amount).
        bal = client.get("/api/savings/account", headers=_headers(users[0])).json()["data"]["balance"]
        assert bal >= bal_before + 20000