from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.contribution import Contribution
from app.models.contribution_member import ContributionMember
from app.models.enums import (
    AuditAction,
    AuditCategory,
    ContributionStatus,
    ScheduleStatus,
    TransactionStatus,
    TransactionType,
)
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.contribution_repository import (
    contribution_member_repository,
    contribution_repository,
    contribution_schedule_repository,
)
from app.repositories.transaction_repository import transaction_repository
from app.schemas.contribution import (
    ContributionMemberOut,
    ContributionOut,
    ContributionScheduleOut,
)

FREQUENCY_DAYS = {
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "custom": 30,
}


def _make_reference() -> str:
    return f"CON-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"


class ContributionService:
    def _build_out(self, contribution: Contribution) -> ContributionOut:
        return ContributionOut(
            id=contribution.id,
            name=contribution.name,
            description=contribution.description,
            organization=contribution.organization,
            amount=contribution.amount,
            frequency=contribution.frequency,
            member_count=contribution.member_count,
            rounds=contribution.rounds,
            start_date=contribution.start_date,
            end_date=contribution.end_date,
            withdrawal_date=contribution.withdrawal_date,
            next_payment_date=contribution.next_payment_date,
            last_payment_date=contribution.last_payment_date,
            total_contributed=contribution.total_contributed,
            total_expected=contribution.total_expected,
            progress=contribution.progress,
            status=contribution.status,
            withdrawal_rule=contribution.withdrawal_rule,
            is_open=contribution.is_open,
            created_by=contribution.created_by,
            created_at=contribution.created_at,
            members=[ContributionMemberOut.model_validate(m) for m in contribution.members],
            schedule=[ContributionScheduleOut.model_validate(s) for s in contribution.schedule],
        )

    def _compute_dates(self, start_date: datetime, frequency: str, rounds: int) -> list[datetime]:
        step = timedelta(days=FREQUENCY_DAYS.get(frequency, 30))
        return [start_date + step * i for i in range(rounds)]

    def _sync_schedule(self, db: Session, contribution: Contribution) -> None:
        contribution.schedule = contribution_schedule_repository.list_schedule(db, contribution.id)
        contribution.members = contribution_member_repository.list_members(db, contribution.id)

    def create(self, db: Session, *, user: User, payload) -> ContributionOut:
        if payload.withdrawal_rule is not None and payload.fixed_withdrawal_date:
            withdrawal_rule = {"type": payload.withdrawal_rule, "fixed_date": payload.fixed_withdrawal_date.isoformat()}
        elif payload.withdrawal_rule is not None:
            withdrawal_rule = {"type": payload.withdrawal_rule}
        else:
            withdrawal_rule = None

        total_expected = payload.amount * payload.rounds
        contribution = contribution_repository.create(
            db,
            created_by=user.id,
            name=payload.name,
            description=payload.description,
            organization=payload.organization,
            amount=payload.amount,
            frequency=payload.frequency,
            member_count=payload.member_count,
            rounds=payload.rounds,
            start_date=payload.start_date,
            withdrawal_date=payload.fixed_withdrawal_date,
            total_expected=total_expected,
            withdrawal_rule=withdrawal_rule,
            status=ContributionStatus.UPCOMING,
        )

        for index, due in enumerate(self._compute_dates(payload.start_date, payload.frequency.value, payload.rounds)):
            contribution_schedule_repository.create(
                db,
                contribution_id=contribution.id,
                period=due.strftime("%Y-%m"),
                label=f"Round {index + 1}",
                due_date=due,
                amount=payload.amount,
            )

        contribution_member_repository.create(
            db,
            contribution_id=contribution.id,
            user_id=user.id,
            display_name=f"{user.first_name} {user.last_name}".strip(),
            avatar=user.avatar,
            position=1,
        )

        contribution.next_payment_date = contribution.schedule[0].due_date if contribution.schedule else None
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Created contribution '{contribution.name}'.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def get(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def list_mine(self, db: Session, *, user: User, status=None, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_mine(db, user.id, status=status, page=page, page_size=page_size)
        return {
            "items": [self._build_out(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def list_open(self, db: Session, *, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_open(db, page=page, page_size=page_size)
        return {
            "items": [self._build_out(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def list_all(self, db: Session, *, status=None, search: str | None = None, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_all(db, status=status, search=search, page=page, page_size=page_size)
        return {
            "items": [self._build_out(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def _get_owned(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> Contribution:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        if contribution.created_by != user.id:
            raise AppException(
                message="Only the contribution creator can do this.",
                status_code=403,
                error_code="NOT_OWNER",
            )
        return contribution

    def update(self, db: Session, *, user: User, contribution_id: uuid.UUID, payload) -> ContributionOut:
        contribution = self._get_owned(db, user=user, contribution_id=contribution_id)
        data = payload.model_dump(exclude_unset=True)

        # Recompute expected total when amount/rounds change.
        revalidate = False
        if "amount" in data or "rounds" in data:
            contribution.total_expected = (data.get("amount") or contribution.amount) * (
                data.get("rounds") or contribution.rounds
            )
            revalidate = True

        if data.pop("withdrawal_rule", None) is not None:
            pass
        if "fixed_withdrawal_date" in data:
            data.pop("fixed_withdrawal_date")

        for key, value in data.items():
            if value is not None:
                setattr(contribution, key, value)

        if revalidate:
            contribution.progress = (
                round(contribution.total_contributed / contribution.total_expected * 100)
                if contribution.total_expected
                else 0
            )

        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Updated contribution '{contribution.name}'.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def delete(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> None:
        contribution = self._get_owned(db, user=user, contribution_id=contribution_id)
        name = contribution.name

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Deleted contribution '{name}'.",
            target=name,
            target_id=contribution.id,
        )
        db.delete(contribution)
        db.flush()

    def join(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        if not contribution.is_open or contribution.status not in (ContributionStatus.UPCOMING, ContributionStatus.ACTIVE):
            raise AppException(
                message="This contribution is not open for joining.",
                status_code=400,
                error_code="NOT_ACCEPTING_MEMBERS",
            )

        existing = contribution_member_repository.get(db, contribution_id, user.id)
        if existing is not None:
            raise AppException(message="You have already joined this contribution.", status_code=400, error_code="ALREADY_MEMBER")

        current = contribution_member_repository.count_members(db, contribution_id)
        next_position = current + 1
        if next_position > contribution.member_count:
            raise AppException(message="This contribution is full.", status_code=400, error_code="CONTRIBUTION_FULL")

        contribution_member_repository.create(
            db,
            contribution_id=contribution_id,
            user_id=user.id,
            display_name=f"{user.first_name} {user.last_name}".strip(),
            avatar=user.avatar,
            position=next_position,
        )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Joined contribution '{contribution.name}' at position {next_position}.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def leave(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> None:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        if contribution.created_by == user.id:
            # Creator leaves -> deletes the contribution.
            name = contribution.name
            audit_log_repository.create(
                db,
                actor_id=user.id,
                actor_name=f"{user.first_name} {user.last_name}",
                actor_email=user.email,
                actor_role=user.role,
                action=AuditAction.DELETE,
                category=AuditCategory.CONTRIBUTION,
                description=f"Deleted contribution '{name}'.",
                target=name,
                target_id=contribution.id,
            )
            db.delete(contribution)
            db.flush()
            return

        member = contribution_member_repository.get(db, contribution_id, user.id)
        if member is None:
            raise AppException(message="You are not a member of this contribution.", status_code=400, error_code="NOT_MEMBER")

        name = contribution.name
        contribution_member_repository.delete(db, member)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Left contribution '{name}'.",
            target=name,
            target_id=contribution.id,
        )

    def pay(self, db: Session, *, user: User, contribution_id: uuid.UUID, schedule_id: int | None) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member = contribution_member_repository.get(db, contribution_id, user.id)
        if member is None:
            raise AppException(message="You are not a member of this contribution.", status_code=403, error_code="NOT_MEMBER")

        schedule = (
            contribution_schedule_repository.get(db, schedule_id)
            if schedule_id
            else contribution_schedule_repository.next_pending(db, contribution_id)
        )
        if schedule is None or schedule.contribution_id != contribution_id or schedule.status == ScheduleStatus.PAID:
            raise AppException(message="No upcoming payment due for this contribution.", status_code=400, error_code="NO_DUE_PAYMENT")

        contribution_schedule_repository.mark_paid(db, schedule)

        transaction_repository.create(
            db,
            user_id=user.id,
            type_=TransactionType.CONTRIBUTION,
            status=TransactionStatus.SUCCESSFUL,
            amount=schedule.amount,
            description=f"{contribution.name} — {schedule.label}",
            reference=_make_reference(),
            details={"contribution_id": str(contribution.id), "schedule_id": schedule.id},
        )

        member.total_contributed += schedule.amount
        contribution.total_contributed += schedule.amount
        contribution.last_payment_date = schedule.due_date

        remaining = contribution_schedule_repository.list_schedule(db, contribution_id)
        pending = [s for s in remaining if s.status == ScheduleStatus.UPCOMING]
        contribution.next_payment_date = pending[0].due_date if pending else None

        if contribution.total_expected:
            contribution.progress = round(contribution.total_contributed / contribution.total_expected * 100)
        if not pending:
            contribution.status = ContributionStatus.COMPLETED
            contribution.end_date = schedule.due_date

        db.flush()

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Paid {schedule.amount} for '{contribution.name}' ({schedule.label}).",
            target=contribution.name,
            target_id=contribution.id,
            details={"schedule_id": schedule.id},
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)


contribution_service = ContributionService()