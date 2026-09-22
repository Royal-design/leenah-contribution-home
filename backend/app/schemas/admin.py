from pydantic import BaseModel

from app.schemas.contribution import ContributionOut
from app.schemas.savings import SavingsAccountDetail
from app.schemas.transaction import TransactionOut


class AdminStats(BaseModel):
    total_users: int
    active_contributions: int
    total_funds: int
    pending_withdrawals: int
    monthly_volume: int
    user_growth: list[dict]
    contribution_volume: list[dict]
    contribution_status: list[dict]
    # Plans platform overview (savings + contribution plans).
    total_plans: int = 0
    active_savings_plans: int = 0
    active_plans: int = 0
    total_in_contribution_plans: int = 0
    total_in_savings_plans: int = 0
    plan_volume: list[dict] = []
    # Financial pipeline metrics.
    pending_emergency_requests: int = 0
    pending_payouts: int = 0
    total_commissions: int = 0
    completed_withdrawals: int = 0
    failed_transactions: int = 0


class AdminUserDetail(BaseModel):
    user: object
    contribution_count: int
    savings_balance: int
    transactions: list[TransactionOut] = []


class AdminOverview(BaseModel):
    stats: AdminStats
    recent_transactions: list[TransactionOut]
    active_contributions: list[ContributionOut] = []
    savings_snapshot: SavingsAccountDetail | None = None