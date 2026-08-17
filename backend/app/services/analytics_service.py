from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.contribution import Contribution
from app.models.enums import AuditAction, AuditCategory, TransactionStatus
from app.models.savings_account import SavingsAccount
from app.models.transaction import Transaction
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.contribution_repository import contribution_repository
from app.repositories.savings_repository import savings_account_repository
from app.repositories.transaction_repository import transaction_repository
from app.repositories.user_repository import user_repository
from app.repositories.withdrawal_repository import withdrawal_repository
from app.schemas.admin import AdminStats
from app.schemas.transaction import TransactionOut


class AnalyticsService:
    def stats(self, db: Session) -> AdminStats:
        now = datetime.now(timezone.utc)

        monthly_volume = transaction_repository.sum_amount(db, since=now - timedelta(days=30))
        total_funds = savings_account_repository_sum(db)

        user_growth = _monthly_series(db, model=User, date_col="created_at", months=6)
        contribution_volume = _transaction_volume(db, months=6)

        status_counts = _contribution_status_counts(db)

        return AdminStats(
            total_users=user_repository.count(db),
            active_contributions=contribution_repository.count_active(db),
            total_funds=total_funds,
            pending_withdrawals=withdrawal_repository.count_pending(db),
            monthly_volume=monthly_volume,
            user_growth=user_growth,
            contribution_volume=contribution_volume,
            contribution_status=status_counts,
        )

    def recent_transactions(self, db: Session, limit: int = 10) -> list[TransactionOut]:
        items, _ = transaction_repository.list_all(db, page=1, page_size=limit)
        return [TransactionOut.model_validate(item) for item in items]

    def user_detail(self, db: Session, user_id: uuid.UUID) -> dict:
        user = user_repository.get(db, user_id)
        if user is None:
            raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")

        from sqlalchemy import func, select

        contributions, _ = contribution_repository.list_mine(db, user_id, page=1, page_size=100)
        account = savings_account_repository.get_for_user(db, user_id)
        transactions, _ = transaction_repository.list_mine(db, user_id, page=1, page_size=20)

        return {
            "user": user,
            "contribution_count": len(contributions),
            "savings_balance": account.balance if account else 0,
            "transactions": [TransactionOut.model_validate(t) for t in transactions],
        }

    def audited_admin_action(self, db: Session, *, actor: User, action: AuditAction, category: AuditCategory, description: str, **extra):
        return audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=action,
            category=category,
            description=description,
            **extra,
        )


def _2026_year() -> int:
    return datetime.now(timezone.utc).year


def savings_account_repository_sum(db: Session) -> int:
    from sqlalchemy import func, select

    from app.models.savings_account import SavingsAccount

    return db.execute(select(func.coalesce(func.sum(SavingsAccount.balance), 0))).scalar_one()


def _month_label(dt: datetime) -> str:
    return dt.strftime("%b %Y") if hasattr(dt, "strftime") else str(dt)


def _monthly_series(db: Session, *, model, date_col: str, months: int) -> list[dict]:
    import calendar

    from sqlalchemy import func, select

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=months * 31)
    rows = db.execute(
        select(func.date_trunc("month", getattr(model, date_col)), func.count(model.id))
        .where(getattr(model, date_col) >= cutoff)
        .group_by(func.date_trunc("month", getattr(model, date_col)))
    ).all()
    counts = {}
    for dt_val, count in rows:
        # Normalize to year-month string for reliable matching
        key = dt_val.strftime("%Y-%m") if hasattr(dt_val, "strftime") else str(dt_val)[:7]
        counts[key] = count

    series = []
    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=31 * i)).replace(day=1)
        key = month_start.strftime("%Y-%m")
        series.append(
            {
                "month": month_start.strftime("%b"),
                "users": counts.get(key, 0),
            }
        )
    return series


def _transaction_volume(db: Session, *, months: int) -> list[dict]:
    from sqlalchemy import func, select

    from app.models.enums import TransactionStatus
    from app.models.transaction import Transaction

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=months * 31)
    rows = db.execute(
        select(func.date_trunc("month", Transaction.date), func.sum(Transaction.amount))
        .where(Transaction.status == TransactionStatus.SUCCESSFUL, Transaction.date >= cutoff)
        .group_by(func.date_trunc("month", Transaction.date))
    ).all()
    volumes = {}
    for dt_val, amount in rows:
        key = dt_val.strftime("%Y-%m") if hasattr(dt_val, "strftime") else str(dt_val)[:7]
        volumes[key] = amount or 0

    series = []
    for i in range(months - 1, -1, -1):
        month_start = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(days=31 * i)).replace(day=1)
        key = month_start.strftime("%Y-%m")
        series.append({"month": month_start.strftime("%b"), "volume": volumes.get(key, 0)})
    return series


def _contribution_status_counts(db: Session) -> list[dict]:
    from sqlalchemy import func, select

    from app.models.contribution import Contribution

    rows = db.execute(select(Contribution.status, func.count(Contribution.id)).group_by(Contribution.status)).all()
    all_statuses = ["active", "upcoming", "completed", "paused", "draft"]
    counts = {status: 0 for status in all_statuses}
    for status, count in rows:
        counts[status.value if hasattr(status, "value") else str(status)] = count
    return [{"name": name, "value": counts[name]} for name in all_statuses]


analytics_service = AnalyticsService()