import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory
from app.models.savings_account import SavingsAccount
from app.models.savings_goal import SavingsGoal
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.savings_repository import savings_account_repository, savings_goal_repository
from app.schemas.savings import SavingsAccountDetail, SavingsGoalOut
from app.services.wallet_service import wallet_service


class SavingsService:
    def _get_account(self, db: Session, user: User) -> SavingsAccount:
        account = savings_account_repository.get_for_user(db, user.id)
        if account is None:
            account = savings_account_repository.create_for_user(db, user.id)
        return account

    def get_account(self, db: Session, *, user: User) -> SavingsAccountDetail:
        account = self._get_account(db, user)
        goals = savings_goal_repository.list_for_account(db, account.id)
        data = SavingsAccountDetail.model_validate(account)
        data.goals = [SavingsGoalOut.model_validate(goal) for goal in goals]
        return data

    def fund(
        self,
        db: Session,
        *,
        user: User,
        amount: int,
        note: str | None,
        ip_address: str | None = None,
        goal_id: uuid.UUID | None = None,
    ) -> SavingsAccountDetail:
        transaction = wallet_service.credit(
            db,
            user_id=user.id,
            amount=amount,
            description=note or "Savings top-up",
            details={"method": "wallet", "channel": "savings"},
        )

        account = self._get_account(db, user)
        goal_name = None
        if goal_id is not None:
            goal = savings_goal_repository.get_for_account(db, goal_id, account.id)
            if goal is None:
                raise AppException(message="Savings goal not found.", status_code=404, error_code="GOAL_NOT_FOUND")
            savings_goal_repository.add_contribution(db, goal, amount)
            goal_name = goal.name

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.SAVINGS,
            description=f"Funded savings account with {amount}." + (f" Allocated to goal '{goal_name}'." if goal_name else ""),
            details={"transaction_id": str(transaction.id), "goal_id": str(goal_id) if goal_id else None},
            ip_address=ip_address,
        )

        return self.get_account(db, user=user)

    def create_goal(self, db: Session, *, user: User, name: str, target: int, color: str | None = None, target_date=None) -> SavingsGoal:
        account = self._get_account(db, user)
        goal = savings_goal_repository.create(
            db, account_id=account.id, name=name, target=target, color=color, target_date=target_date
        )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.SAVINGS,
            description=f"Created savings goal '{name}'.",
            target=name,
            target_id=goal.id,
        )
        return goal

    def list_goals(self, db: Session, *, user: User) -> list[SavingsGoal]:
        account = self._get_account(db, user)
        return savings_goal_repository.list_for_account(db, account.id)

    def get_goal(self, db: Session, *, user: User, goal_id: uuid.UUID) -> SavingsGoal:
        account = self._get_account(db, user)
        goal = savings_goal_repository.get(db, goal_id)
        if goal is None or goal.account_id != account.id:
            raise AppException(message="Savings goal not found.", status_code=404, error_code="GOAL_NOT_FOUND")
        return goal

    def update_goal(self, db: Session, *, user: User, goal_id: uuid.UUID, **fields) -> SavingsGoal:
        goal = self.get_goal(db, user=user, goal_id=goal_id)
        savings_goal_repository.update(db, goal, **fields)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SAVINGS,
            description=f"Updated savings goal '{goal.name}'.",
            target=goal.name,
            target_id=goal.id,
        )
        return goal

    def delete_goal(self, db: Session, *, user: User, goal_id: uuid.UUID) -> None:
        goal = self.get_goal(db, user=user, goal_id=goal_id)
        name = goal.name
        savings_goal_repository.delete(db, goal)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.SAVINGS,
            description=f"Deleted savings goal '{name}'.",
            target=name,
            target_id=goal_id,
        )


savings_service = SavingsService()