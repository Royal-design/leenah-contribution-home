"""Seed a small development dataset.

Resets the database to a clean, demo-friendly state:

    - 2 users : 1 admin + 1 regular user (every other user is removed)
    - 2 contribution plans (created by the admin, open for joining)
    - a few transactions: mock wallet funding + one contribution payment

Usage:
    python seed.py
"""

import argparse

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.contribution import Contribution
from app.models.enums import AuthProvider, FundingMethod, UserRole, UserStatus
from app.models.user import User
from app.schemas.contribution import ContributionCreate
from app.services.contribution_service import contribution_service
from app.services.wallet_service import wallet_service

ADMIN_EMAIL = "admin@gmail.com"
USER_EMAIL = "user@gmail.com"
DEFAULT_PASSWORD = "Password@2026"


def _upsert_user(db, *, email: str, first_name: str, last_name: str, role: UserRole, password: str) -> User:
    user = db.query(User).filter(User.email == email).one_or_none()
    roles = [UserRole.ADMIN, UserRole.USER] if role == UserRole.ADMIN else [UserRole.USER]
    if user is None:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=hash_password(password),
            role=role,
            roles=roles,
            status=UserStatus.ACTIVE,
            provider=AuthProvider.CREDENTIALS,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
    else:
        user.first_name = first_name
        user.last_name = last_name
        user.password = hash_password(password)
        user.role = role
        user.roles = roles
        user.status = UserStatus.ACTIVE
        user.provider = AuthProvider.CREDENTIALS
        user.is_active = True
        user.is_verified = True
    db.flush()
    return user


def _reset_data(db) -> None:
    """Remove test clutter so only the seeded admin + user remain."""
    from app.models.audit_log import AuditLog
    from app.models.notification import Notification
    from app.models.savings_account import SavingsAccount
    from app.models.transaction import Transaction

    kept = db.query(User).filter(User.email.in_([ADMIN_EMAIL, USER_EMAIL])).all()
    kept_ids = {u.id for u in kept}

    db.query(Notification).delete(synchronize_session=False)
    db.query(AuditLog).delete(synchronize_session=False)
    db.query(Transaction).delete(synchronize_session=False)
    db.query(Contribution).delete(synchronize_session=False)
    db.query(SavingsAccount).update(
        {SavingsAccount.balance: 0, SavingsAccount.total_saved: 0, SavingsAccount.total_withdrawn: 0},
        synchronize_session=False,
    )
    db.query(User).filter(~User.id.in_(kept_ids)).delete(synchronize_session=False)
    db.flush()


def _create_plan(db, *, admin: User, name: str, amount: int, frequency: str, member_count: int, rounds: int, start_date: str) -> Contribution:
    payload = ContributionCreate(
        name=name,
        description="Demo contribution plan.",
        organization="LCH",
        amount=amount,
        frequency=frequency,
        member_count=member_count,
        rounds=rounds,
        start_date=start_date,
        withdrawal_rule="on_schedule",
    )
    result = contribution_service.create(db, user=admin, payload=payload)
    return db.query(Contribution).filter(Contribution.id == result.id).one()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a minimal LCH dataset.")
    parser.add_argument("--admin-password", default=DEFAULT_PASSWORD)
    parser.add_argument("--user-password", default=DEFAULT_PASSWORD)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        _reset_data(db)

        admin = _upsert_user(
            db, email=ADMIN_EMAIL, first_name="LCH", last_name="Admin", role=UserRole.ADMIN, password=args.admin_password
        )
        user = _upsert_user(
            db, email=USER_EMAIL, first_name="Demo", last_name="User", role=UserRole.USER, password=args.user_password
        )

        plan_a = _create_plan(
            db,
            admin=admin,
            name="Monthly Builders",
            amount=20000,
            frequency="monthly",
            member_count=5,
            rounds=10,
            start_date="2026-09-01T00:00:00Z",
        )
        _create_plan(
            db,
            admin=admin,
            name="Weekly Circle",
            amount=10000,
            frequency="weekly",
            member_count=4,
            rounds=8,
            start_date="2026-08-20T00:00:00Z",
        )

        # Mock wallet funding (creates FUNDING transactions + balance).
        wallet_service.credit(
            db,
            user_id=user.id,
            amount=200000,
            description="Mock wallet top-up",
            details={"method": "mock"},
        )
        wallet_service.credit(
            db,
            user_id=user.id,
            amount=50000,
            description="Mock wallet top-up",
            details={"method": "mock"},
        )

        # Demo the full flow: join + pay round 1 (creates a CONTRIBUTION txn).
        member = contribution_service.join(db, user=user, contribution_id=plan_a.id)
        schedule_id = member.schedule[0].id
        contribution_service.pay(
            db,
            user=user,
            contribution_id=plan_a.id,
            schedule_id=schedule_id,
            funding_method=FundingMethod.WALLET,
        )

        db.commit()
        print("Seeded LCH demo data:")
        print(f"  Admin: {ADMIN_EMAIL} / {args.admin_password}")
        print(f"  User:  {USER_EMAIL} / {args.user_password}")
        print("  2 contribution plans, 2 funding transactions, 1 contribution payment.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()