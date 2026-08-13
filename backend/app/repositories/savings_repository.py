import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.savings_account import SavingsAccount
from app.models.savings_goal import SavingsGoal


class SavingsAccountRepository:
    def get_for_user(self, db: Session, user_id: uuid.UUID) -> SavingsAccount | None:
        return db.execute(select(SavingsAccount).where(SavingsAccount.user_id == user_id)).scalar_one_or_none()

    def create_for_user(self, db: Session, user_id: uuid.UUID) -> SavingsAccount:
        account = SavingsAccount(user_id=user_id)
        db.add(account)
        db.flush()
        return account

    def credit(self, db: Session, account: SavingsAccount, amount: int) -> None:
        account.balance += amount
        account.total_saved += amount
        db.flush()

    def debit(self, db: Session, account: SavingsAccount, amount: int) -> None:
        account.balance -= amount
        account.total_withdrawn += amount
        db.flush()


class SavingsGoalRepository:
    def create(self, db: Session, *, account_id: uuid.UUID, name: str, target: int, color: str | None = None, target_date=None) -> SavingsGoal:
        goal = SavingsGoal(account_id=account_id, name=name, target=target, color=color, target_date=target_date)
        db.add(goal)
        db.flush()
        return goal

    def get(self, db: Session, goal_id: uuid.UUID) -> SavingsGoal | None:
        return db.get(SavingsGoal, goal_id)

    def list_for_account(self, db: Session, account_id: uuid.UUID) -> list[SavingsGoal]:
        return list(
            db.execute(
                select(SavingsGoal).where(SavingsGoal.account_id == account_id).order_by(SavingsGoal.created_at.desc())
            ).scalars().all()
        )

    def update(self, db: Session, goal: SavingsGoal, **fields) -> SavingsGoal:
        for key, value in fields.items():
            if value is not None:
                setattr(goal, key, value)
        db.flush()
        return goal

    def delete(self, db: Session, goal: SavingsGoal) -> None:
        db.delete(goal)
        db.flush()


savings_account_repository = SavingsAccountRepository()
savings_goal_repository = SavingsGoalRepository()