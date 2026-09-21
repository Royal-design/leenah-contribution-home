from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.contribution import Contribution
from app.models.contribution_member import ContributionMember
from app.models.enums import (
    AuditAction,
    AuditCategory,
    ContributionStatus,
    FundingMethod,
    MemberStatus,
    NotificationType,
    PayoutStatus,
    ScheduleStatus,
    TransactionType,
)
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.contribution_repository import (
    contribution_member_repository,
    contribution_payout_repository,
    contribution_repository,
    contribution_schedule_repository,
)
from app.repositories.user_repository import user_repository
from app.schemas.contribution import (
    ContributionMemberOut,
    ContributionOut,
    ContributionPayoutOut,
    ContributionScheduleOut,
)
from app.services.notification_service import notification_service
from app.services.wallet_service import make_reference, wallet_service
from app.utils.dates import (
    end_date_from_duration,
    payout_date_at,
    period_dates,
    start_date_change_forbidden,
    start_date_in_past,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ContributionService:
    def _base_fields(self, contribution: Contribution) -> dict:
        return {
            "id": contribution.id,
            "name": contribution.name,
            "description": contribution.description,
            "organization": contribution.organization,
            "amount": contribution.amount,
            "frequency": contribution.frequency,
            "member_count": contribution.member_count,
            "rounds": contribution.rounds,
            "start_date": contribution.start_date,
            "end_date": contribution.end_date,
            "withdrawal_date": contribution.withdrawal_date,
            "next_payment_date": contribution.next_payment_date,
            "last_payment_date": contribution.last_payment_date,
            "total_contributed": contribution.total_contributed,
            "total_expected": contribution.total_expected,
            "progress": contribution.progress,
            "status": contribution.status,
            "withdrawal_rule": contribution.withdrawal_rule,
            "is_open": contribution.is_open,
            "created_by": contribution.created_by,
            "created_at": contribution.created_at,
        }

    def _build_out(self, contribution: Contribution, *, member_id: uuid.UUID | None = None) -> ContributionOut:
        members_in = [m for m in contribution.members if m.status == MemberStatus.ACTIVE]

        if member_id is not None:
            schedule_in = [s for s in contribution.schedule if s.member_id == member_id]
            payouts_in = [p for p in contribution.payouts if p.member_id == member_id]
        else:
            schedule_in = [s for s in contribution.schedule if s.member_id is None]
            payouts_in = list(contribution.payouts)

        return ContributionOut(
            **self._base_fields(contribution),
            members=[ContributionMemberOut.model_validate(m) for m in members_in],
            schedule=[ContributionScheduleOut.model_validate(s) for s in schedule_in],
            payouts=[ContributionPayoutOut.model_validate(p) for p in payouts_in],
        )

    def _build_list_out(self, contribution: Contribution) -> ContributionOut:
        """Lightweight list item: summary fields + active members only.

        List endpoints skip the per-member schedules/payouts so they stay fast
        and small; detail endpoints keep the full serialization.
        """
        members_in = [m for m in contribution.members if m.status == MemberStatus.ACTIVE]
        return ContributionOut(
            **self._base_fields(contribution),
            members=[ContributionMemberOut.model_validate(m) for m in members_in],
            schedule=[],
            payouts=[],
        )

    @staticmethod
    def _paginated(*, total: int, page: int, page_size: int) -> dict:
        pages = (total + page_size - 1) // page_size if total else 0
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
            "has_next": page < pages,
            "has_prev": page > 1,
            "next": page + 1 if page < pages else None,
            "prev": page - 1 if page > 1 else None,
        }

    def _compute_dates(self, start_date: datetime, frequency: str, rounds: int) -> list[datetime]:
        """Calendar-aware due dates (month-end / leap-year safe for monthly)."""
        return period_dates(start_date, frequency, rounds)

    def _member_id_for(self, db: Session, contribution_id: uuid.UUID, user_id: uuid.UUID) -> uuid.UUID | None:
        member = contribution_member_repository.get(db, contribution_id, user_id)
        if member is not None and member.status == MemberStatus.ACTIVE:
            return member.id
        return None

    def _sync_schedule(self, db: Session, contribution: Contribution) -> None:
        contribution.schedule = contribution_schedule_repository.list_schedule(db, contribution.id)
        contribution.members = contribution_member_repository.list_members(db, contribution.id)
        contribution.payouts = contribution_payout_repository.list_for_contribution(db, contribution.id)

    def _reconcile_payout_dates(self, db: Session, contribution: Contribution) -> None:
        """Bring stored payout dates in line with the derived rotation schedule.

        The withdrawal date follows deterministically from the plan start,
        frequency and member position (monthly plans pay at the end of each
        month). This re-syncs pre-existing memberships that may still hold an
        older date, so displayed withdrawal dates are always correct.
        """
        for member in contribution_member_repository.list_active(db, contribution.id):
            self._sync_member_payout(db, contribution, member)

    def _recompute_totals(self, db: Session, contribution: Contribution) -> None:
        active = [m for m in contribution.members if m.status == MemberStatus.ACTIVE]
        active_member_ids = {m.id for m in active}

        # Sum over ALL members (including LEFT/REMOVED) so financial history is
        # never lost when someone leaves.
        contribution.total_contributed = sum(m.total_contributed for m in contribution.members)

        expected = contribution.amount * contribution.member_count * contribution.rounds
        contribution.total_expected = expected
        contribution.progress = round(contribution.total_contributed / expected * 100) if expected else 0

        due = [
            s.due_date
            for s in contribution.schedule
            if s.member_id is not None
            and s.member_id in active_member_ids
            and s.status != ScheduleStatus.PAID
        ]
        contribution.next_payment_date = min(due) if due else None

        if active and not due:
            contribution.status = ContributionStatus.COMPLETED
            if contribution.end_date is None:
                paid = [s.paid_at for s in contribution.schedule if s.paid_at is not None]
                contribution.end_date = max(paid) if paid else contribution.start_date

        db.flush()

    # ------------------------------------------------------------------ create

    def create(self, db: Session, *, user: User, payload) -> ContributionOut:
        if payload.withdrawal_rule is not None and payload.fixed_withdrawal_date:
            withdrawal_rule = {"type": payload.withdrawal_rule, "fixed_date": payload.fixed_withdrawal_date.isoformat()}
        elif payload.withdrawal_rule is not None:
            withdrawal_rule = {"type": payload.withdrawal_rule}
        else:
            withdrawal_rule = None

        end_date = payload.end_date
        if end_date is None:
            if payload.duration_months:
                end_date = end_date_from_duration(payload.start_date, payload.duration_months)
            else:
                dates = self._compute_dates(payload.start_date, payload.frequency.value, payload.rounds)
                end_date = dates[-1] if dates else payload.start_date

        if start_date_in_past(payload.start_date):
            raise AppException(
                message="Start date cannot be in the past.",
                status_code=422,
                error_code="START_DATE_IN_PAST",
            )

        if payload.member_count > payload.rounds:
            raise AppException(
                message=(
                    "A contribution plan supports one withdrawal position per "
                    f"contribution round. Reduce participants below or equal to {payload.rounds}."
                ),
                status_code=422,
                error_code="CAPACITY_EXCEEDS_ROUNDS",
            )

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
            end_date=end_date,
            withdrawal_date=payload.fixed_withdrawal_date,
            withdrawal_rule=withdrawal_rule,
            status=ContributionStatus.UPCOMING,
        )

        for index, due in enumerate(self._compute_dates(payload.start_date, payload.frequency.value, payload.rounds)):
            contribution_schedule_repository.create(
                db,
                contribution_id=contribution.id,
                member_id=None,
                period=due.strftime("%Y-%m"),
                label=f"Round {index + 1}",
                due_date=due,
                amount=payload.amount,
            )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)

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

        notification_service.notify_all_users(
            db,
            title="New contribution plan",
            message=f"{contribution.name} is now available — {contribution.amount}/{contribution.frequency.value}.",
            type_=NotificationType.CONTRIBUTION,
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def get(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        self._reconcile_payout_dates(db, contribution)
        self._sync_schedule(db, contribution)
        member_id = self._member_id_for(db, contribution_id, user.id)
        return self._build_out(contribution, member_id=member_id)

    def list_mine(self, db: Session, *, user: User, status=None, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_mine(db, user.id, status=status, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
        }

    def list_open(self, db: Session, *, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_open(db, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
        }

    def list_all(self, db: Session, *, status=None, search: str | None = None, page: int = 1, page_size: int = 20):
        items, total = contribution_repository.list_all(db, status=status, search=search, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
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

    def _apply_update(self, db: Session, contribution: Contribution, payload) -> None:
        data = payload.model_dump(exclude_unset=True)

        if "start_date" in data and data["start_date"] is not None:
            if start_date_change_forbidden(data["start_date"], contribution.start_date):
                raise AppException(
                    message="Start date cannot be in the past.",
                    status_code=422,
                    error_code="START_DATE_IN_PAST",
                )

        if "member_count" in data and data["member_count"] is not None:
            effective_rounds = data.get("rounds") or contribution.rounds
            if data["member_count"] > effective_rounds:
                raise AppException(
                    message=(
                        "A contribution plan supports one withdrawal position per "
                        f"contribution round. Use {effective_rounds} or fewer participants."
                    ),
                    status_code=422,
                    error_code="CAPACITY_EXCEEDS_ROUNDS",
                )

        if "withdrawal_date" in data:
            withdrawal_date = data.pop("withdrawal_date")
            contribution.withdrawal_date = withdrawal_date
            contribution.withdrawal_rule = (
                {"type": "fixed_date", "fixed_date": withdrawal_date.isoformat()}
                if withdrawal_date is not None
                else None
            )

        if data.pop("withdrawal_rule", None) is not None:
            pass
        if "fixed_withdrawal_date" in data:
            data.pop("fixed_withdrawal_date")

        for key, value in data.items():
            if value is not None:
                setattr(contribution, key, value)

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)

        db.flush()

    def update(self, db: Session, *, user: User, contribution_id: uuid.UUID, payload) -> ContributionOut:
        contribution = self._get_owned(db, user=user, contribution_id=contribution_id)
        self._apply_update(db, contribution, payload)

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

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Deleted contribution '{contribution.name}'.",
            target=contribution.name,
            target_id=contribution.id,
        )
        db.delete(contribution)
        db.flush()

    def admin_update(self, db: Session, *, actor: User, contribution_id: uuid.UUID, payload) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        self._apply_update(db, contribution, payload)

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Admin updated contribution '{contribution.name}'.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        return self._build_out(contribution)

    def admin_delete(self, db: Session, *, actor: User, contribution_id: uuid.UUID) -> None:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        name = contribution.name

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Admin deleted contribution '{name}'.",
            target=name,
            target_id=contribution.id,
        )
        db.delete(contribution)
        db.flush()

    # ------------------------------------------------------- member schedules

    def _create_member_schedules(self, db: Session, contribution: Contribution, member: ContributionMember) -> None:
        dates = self._compute_dates(contribution.start_date, contribution.frequency.value, contribution.rounds)
        for index, due in enumerate(dates):
            contribution_schedule_repository.create(
                db,
                contribution_id=contribution.id,
                member_id=member.id,
                period=due.strftime("%Y-%m"),
                label=f"Round {index + 1}",
                due_date=due,
                amount=contribution.amount,
            )

        member_schedules = contribution_schedule_repository.list_for_member(db, contribution.id, member.id)
        if member_schedules:
            contribution_member_repository.set_next_payment_date(db, member, member_schedules[0].due_date)

        self._sync_member_payout(db, contribution, member)

    def _payout_date_for(self, contribution: Contribution, position: int) -> datetime:
        """Withdrawal date for a member holding ``position`` in the rotation."""
        rule = contribution.withdrawal_rule or {}
        if rule.get("type") == "fixed_date":
            return contribution.withdrawal_date or payout_date_at(
                contribution.start_date, contribution.frequency.value, position
            )
        return payout_date_at(contribution.start_date, contribution.frequency.value, position)

    def _sync_member_payout(
        self,
        db: Session,
        contribution: Contribution,
        member: ContributionMember,
        position: int | None = None,
    ) -> None:
        """Create or move a member's single (rotational) payout to a position.

        Idempotent: re-syncs the payout when a position changes so the
        withdrawal schedule always matches the current rotation order.
        """
        position = position or member.position
        scheduled_date = self._payout_date_for(contribution, position)
        payouts = contribution_payout_repository.list_for_member(db, contribution.id, member.id)
        if payouts:
            payout = payouts[0]
            payout.round_number = position
            payout.scheduled_date = scheduled_date
        else:
            contribution_payout_repository.create(
                db,
                contribution_id=contribution.id,
                member_id=member.id,
                round_number=position,
                scheduled_date=scheduled_date,
                amount=contribution.amount * contribution.member_count,
            )
        db.flush()

    # ------------------------------------------------------------- membership

    def _join_member(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> ContributionOut:
        # Lock the contribution row so concurrent joins serialize and the
        # "next available position" can never be handed out twice.
        contribution = contribution_repository.get_locked(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")
        if not contribution.is_open or contribution.status not in (ContributionStatus.UPCOMING, ContributionStatus.ACTIVE):
            raise AppException(
                message="This contribution is not open for joining.",
                status_code=400,
                error_code="NOT_ACCEPTING_MEMBERS",
            )

        if start_date_in_past(contribution.start_date):
            raise AppException(
                message="This contribution has already started and is not open for joining. Contact an admin to be added.",
                status_code=400,
                error_code="NOT_ACCEPTING_MEMBERS",
            )

        active_count = contribution_member_repository.count_active(db, contribution_id)
        next_position = active_count + 1
        if next_position > contribution.member_count:
            raise AppException(message="This contribution is full.", status_code=400, error_code="CONTRIBUTION_FULL")

        existing = contribution_member_repository.get(db, contribution_id, user.id)
        if existing is not None:
            if existing.status == MemberStatus.ACTIVE:
                raise AppException(message="You have already joined this contribution.", status_code=400, error_code="ALREADY_MEMBER")
            # Rejoining is allowed — restore the historical membership.
            existing.status = MemberStatus.ACTIVE
            existing.position = next_position
            existing.payout_position = next_position
            existing.display_name = f"{user.first_name} {user.last_name}".strip()
            existing.avatar = user.avatar
            joining_action = "Rejoined"
            member = existing
        else:
            member = contribution_member_repository.create(
                db,
                contribution_id=contribution_id,
                user_id=user.id,
                display_name=f"{user.first_name} {user.last_name}".strip(),
                avatar=user.avatar,
                position=next_position,
                payout_position=next_position,
            )
            joining_action = "Joined"

        if not contribution_schedule_repository.list_for_member(db, contribution_id, member.id):
            self._create_member_schedules(db, contribution, member)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"{joining_action} contribution '{contribution.name}' at position {next_position}.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)
        member_id = self._member_id_for(db, contribution_id, user.id)
        return self._build_out(contribution, member_id=member_id)

    def join(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> ContributionOut:
        result = self._join_member(db, user=user, contribution_id=contribution_id)
        notification_service.create(
            db,
            user_id=user.id,
            title="Contribution joined",
            message="You have joined the contribution. Your first payment due date has been scheduled.",
            type_=NotificationType.CONTRIBUTION,
        )
        return result

    def leave(self, db: Session, *, user: User, contribution_id: uuid.UUID) -> None:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member = contribution_member_repository.get(db, contribution_id, user.id)
        if member is None or member.status == MemberStatus.LEFT:
            raise AppException(message="You are not a member of this contribution.", status_code=400, error_code="NOT_MEMBER")

        contribution_member_repository.set_status(db, member, MemberStatus.LEFT)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Left contribution '{contribution.name}'. History preserved.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)

    def admin_add_member(self, db: Session, *, actor: User, contribution_id: uuid.UUID, user_id: uuid.UUID) -> ContributionOut:
        contribution = contribution_repository.get_locked(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member_user = user_repository.get(db, user_id)
        if member_user is None:
            raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")

        existing = contribution_member_repository.get(db, contribution_id, user_id)
        active_count = contribution_member_repository.count_active(db, contribution_id)
        next_position = active_count + 1
        if existing is not None and existing.status == MemberStatus.ACTIVE:
            raise AppException(
                message="This user is already a member of the contribution.",
                status_code=400,
                error_code="ALREADY_MEMBER",
            )
        if next_position > contribution.member_count:
            raise AppException(message="This contribution is full.", status_code=400, error_code="CONTRIBUTION_FULL")

        if existing is not None:
            existing.status = MemberStatus.ACTIVE
            existing.position = next_position
            existing.payout_position = next_position
            existing.display_name = f"{member_user.first_name} {member_user.last_name}".strip()
            existing.avatar = member_user.avatar
            member = existing
        else:
            member = contribution_member_repository.create(
                db,
                contribution_id=contribution_id,
                user_id=user_id,
                display_name=f"{member_user.first_name} {member_user.last_name}".strip(),
                avatar=member_user.avatar,
                position=next_position,
                payout_position=next_position,
            )

        if not contribution_schedule_repository.list_for_member(db, contribution_id, member.id):
            self._create_member_schedules(db, contribution, member)

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Admin added {member_user.first_name} {member_user.last_name} to '{contribution.name}' at position {next_position}.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)
        return self._build_out(contribution)

    def admin_set_position(self, db: Session, *, actor: User, contribution_id: uuid.UUID, user_id: uuid.UUID, position: int) -> ContributionOut:
        """Move a member to an absolute rotational position.

        The rotation can only be changed before the plan has started / before
        any contributions or payouts have been processed. After that the order
        is locked so an active cycle cannot be corrupted.
        """
        contribution = contribution_repository.get_locked(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member = contribution_member_repository.get(db, contribution_id, user_id)
        if member is None or member.status != MemberStatus.ACTIVE:
            raise AppException(
                message="This user is not an active member of the contribution.",
                status_code=404,
                error_code="NOT_MEMBER",
            )

        active = contribution_member_repository.list_active(db, contribution_id)
        if position < 1 or position > len(active):
            raise AppException(
                message=f"Position must be between 1 and {len(active)}.",
                status_code=422,
                error_code="INVALID_POSITION",
            )

        if member.position == position:
            return self._build_out(contribution)

        if start_date_in_past(contribution.start_date) or contribution.status in (
            ContributionStatus.ACTIVE,
            ContributionStatus.COMPLETED,
        ):
            raise AppException(
                message="The rotation is locked once a contribution has started.",
                status_code=400,
                error_code="ROTATION_LOCKED",
            )

        has_history = any(
            s.status == ScheduleStatus.PAID
            for s in contribution_schedule_repository.list_schedule(db, contribution_id)
        ) or any(
            p.status == PayoutStatus.PAID
            for p in contribution_payout_repository.list_for_contribution(db, contribution_id)
        )
        if has_history:
            raise AppException(
                message="The rotation is locked once contributions or withdrawals have begun.",
                status_code=400,
                error_code="ROTATION_LOCKED",
            )

        ordered = [m for m in active if m.id != member.id]
        ordered.insert(position - 1, member)

        changes = []
        for index, item in enumerate(ordered, start=1):
            if item.position != index:
                contribution_member_repository.set_position(db, item, index)
                self._sync_member_payout(db, contribution, item, index)
                changes.append((item.display_name, index))

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.CONTRIBUTION,
            description=(
                f"Admin repositioned {changes[0][0] if changes else member.display_name} "
                f"to #{position} in '{contribution.name}'."
            ),
            target=contribution.name,
            target_id=contribution.id,
            details={"moved_to": [{"member": name, "position": pos} for name, pos in changes]},
        )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)
        return self._build_out(contribution)

    def admin_remove_member(self, db: Session, *, actor: User, contribution_id: uuid.UUID, user_id: uuid.UUID) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member = contribution_member_repository.get(db, contribution_id, user_id)
        if member is None:
            raise AppException(
                message="This user is not a member of the contribution.",
                status_code=400,
                error_code="NOT_MEMBER",
            )

        if contribution.created_by == user_id:
            raise AppException(
                message="The contribution creator cannot be removed.",
                status_code=400,
                error_code="CANNOT_REMOVE_CREATOR",
            )

        contribution_member_repository.set_status(db, member, MemberStatus.REMOVED)

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.DELETE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Admin removed {member.display_name} from '{contribution.name}'. History preserved.",
            target=contribution.name,
            target_id=contribution.id,
        )

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)
        return self._build_out(contribution)

    # ------------------------------------------------------------- payments

    def _attempt_payment(
        self,
        db: Session,
        contribution: Contribution,
        member: ContributionMember,
        schedule,
        *,
        persist_failure: bool = False,
    ) -> bool:
        """Debit wallet + mark schedule paid + update totals. Atomic per request.

        Returns True on success. Records an INSUFFICIENT_FUNDS failure and
        returns False when the wallet is too low; schedule stays PENDING. When
        `persist_failure` is set, the failure record is committed so it survives
        the request being rolled back (the endpoint returns 400).
        """
        try:
            transaction = wallet_service.debit(
                db,
                user_id=member.user_id,
                amount=schedule.amount,
                description=f"{contribution.name} — {schedule.label}",
                reference=make_reference("CON"),
                type_=TransactionType.CONTRIBUTION,
                details={
                    "contribution_id": str(contribution.id),
                    "schedule_id": schedule.id,
                    "member_id": str(member.id),
                    "method": member.funding_method.value,
                },
            )
        except AppException as exc:
            if exc.error_code == "INSUFFICIENT_FUNDS":
                contribution_schedule_repository.record_failure(db, schedule, "insufficient_funds")
                if persist_failure:
                    db.commit()
                return False
            raise

        contribution_schedule_repository.mark_paid(
            db, schedule, transaction_id=transaction.id, paid_at=_utcnow()
        )
        contribution_member_repository.add_contribution(db, member, schedule.amount)
        contribution.last_payment_date = schedule.due_date

        self._sync_schedule(db, contribution)
        self._recompute_totals(db, contribution)

        pending = [
            s
            for s in contribution.schedule
            if s.member_id is not None and s.status != ScheduleStatus.PAID
        ]
        member_next = [
            s
            for s in contribution.schedule
            if s.member_id == member.id and s.status != ScheduleStatus.PAID
        ]
        contribution_member_repository.set_next_payment_date(
            db, member, member_next[0].due_date if member_next else None
        )
        if not pending:
            contribution.status = ContributionStatus.COMPLETED
            contribution.end_date = schedule.due_date

        owner = member.user
        audit_log_repository.create(
            db,
            actor_id=member.user_id,
            actor_name=member.display_name,
            actor_email=owner.email if owner else "",
            actor_role=owner.role if owner else None,
            action=AuditAction.CREATE,
            category=AuditCategory.CONTRIBUTION,
            description=f"Paid {schedule.amount} for '{contribution.name}' ({schedule.label}).",
            target=contribution.name,
            target_id=contribution.id,
            details={"schedule_id": schedule.id, "transaction_id": str(transaction.id)},
        )

        notification_service.create(
            db,
            user_id=member.user_id,
            title="Payment recorded",
            message=f"You paid {schedule.amount} for '{contribution.name}' ({schedule.label}) from your wallet.",
            type_=NotificationType.CONTRIBUTION,
        )
        return True

    def pay(
        self,
        db: Session,
        *,
        user: User,
        contribution_id: uuid.UUID,
        schedule_id: int | None = None,
        funding_method: FundingMethod = FundingMethod.WALLET,
    ) -> ContributionOut:
        contribution = contribution_repository.get(db, contribution_id)
        if contribution is None:
            raise AppException(message="Contribution not found.", status_code=404, error_code="CONTRIBUTION_NOT_FOUND")

        member = contribution_member_repository.get(db, contribution_id, user.id)
        if member is None or member.status != MemberStatus.ACTIVE:
            raise AppException(message="You are not an active member of this contribution.", status_code=403, error_code="NOT_MEMBER")

        if funding_method != FundingMethod.WALLET:
            raise AppException(
                message="Card and bank transfer funding are not available yet. Use your wallet.",
                status_code=400,
                error_code="FUNDING_METHOD_UNAVAILABLE",
            )

        if schedule_id is not None:
            schedule = contribution_schedule_repository.get_locked(db, schedule_id)
            if (
                schedule is None
                or schedule.contribution_id != contribution_id
                or schedule.member_id != member.id
            ):
                raise AppException(
                    message="No upcoming payment due for this contribution.",
                    status_code=400,
                    error_code="NO_DUE_PAYMENT",
                )
        else:
            schedule = contribution_schedule_repository.next_due_for_member(db, contribution_id, member.id)
            if schedule is None:
                raise AppException(
                    message="No upcoming payment due for this contribution.",
                    status_code=400,
                    error_code="NO_DUE_PAYMENT",
                )

        if schedule.status == ScheduleStatus.PAID:
            raise AppException(
                message="This payment has already been made.",
                status_code=400,
                error_code="ALREADY_PAID",
            )

        paid = self._attempt_payment(db, contribution, member, schedule, persist_failure=True)
        if not paid:
            raise AppException(
                message="Insufficient wallet balance to cover this contribution.",
                status_code=400,
                error_code="INSUFFICIENT_FUNDS",
            )

        self._process_rotation_payouts(db, contribution)
        self._sync_schedule(db, contribution)
        return self._build_out(contribution, member_id=member.id)

    def _process_rotation_payouts(self, db: Session, contribution: Contribution) -> dict:
        """Pay the rotation for rounds whose contributions are complete.

        Rotational model: the member at position ``p`` receives the pooled
        round-``p`` contributions once *every* active member has paid at least
        ``p`` schedules. Idempotent — payouts already PAID are never credited
        again. The money is credited to the member's wallet ledger so they can
        withdraw it like any other balance.
        """
        active = contribution_member_repository.list_active(db, contribution.id)
        if not active:
            return {"payouts": 0}

        payouts = {
            p.member_id: p
            for p in contribution_payout_repository.list_for_contribution(db, contribution.id)
        }
        paid_per_member = {
            member.id: sum(
                1
                for s in contribution.schedule
                if s.member_id == member.id and s.status == ScheduleStatus.PAID
            )
            for member in active
        }

        total_payouts = 0
        for member in sorted(active, key=lambda m: m.position):
            position = member.position
            if position < 1:
                continue
            if any(paid_per_member.get(m.id, 0) < position for m in active):
                continue

            payout = payouts.get(member.id)
            if payout is None or payout.status != PayoutStatus.PENDING:
                continue

            contributors = [m for m in active if paid_per_member.get(m.id, 0) >= position]
            actual_amount = contribution.amount * len(contributors)
            if actual_amount <= 0:
                continue

            transaction = wallet_service.credit(
                db,
                user_id=member.user_id,
                amount=actual_amount,
                description=f"Contribution payout — {contribution.name} (Round {position})",
                reference=make_reference("PAY"),
                type_=TransactionType.CONTRIBUTION,
                details={
                    "contribution_id": str(contribution.id),
                    "payout": True,
                    "member_id": str(member.id),
                    "round_number": position,
                    "expected_amount": payout.amount,
                },
            )
            payout.status = PayoutStatus.PAID
            payout.paid_at = _utcnow()
            payout.transaction_id = transaction.id
            db.flush()
            total_payouts += 1

            owner = member.user
            audit_log_repository.create(
                db,
                actor_id=member.user_id,
                actor_name=member.display_name,
                actor_email=owner.email if owner else "",
                actor_role=owner.role if owner else None,
                action=AuditAction.CREATE,
                category=AuditCategory.CONTRIBUTION,
                description=f"Rotational payout {actual_amount} for '{contribution.name}' (Round {position}).",
                target=contribution.name,
                target_id=contribution.id,
                details={"round_number": position, "transaction_id": str(transaction.id)},
            )

            notification_service.create(
                db,
                user_id=member.user_id,
                title="Your contribution payout is in",
                message=f"We credited {actual_amount} to your wallet for '{contribution.name}' (Round {position}).",
                type_=NotificationType.CONTRIBUTION,
            )

        return {"payouts": total_payouts}

    def run_automatic_contributions(self, db: Session, *, contribution_id: uuid.UUID | None = None) -> dict:
        """Attempt to collect pending due contributions via automatic wallet funding.

        Also processes the rotational payout for any round whose contributions
        are now complete. Safe to run from a scheduler. Payments short on funds
        are recorded on the schedule (failure_reason=insufficient_funds) and
        left PENDING/retryable.
        """
        now = _utcnow()

        if contribution_id is not None:
            contribution = contribution_repository.get(db, contribution_id)
            ids = [contribution.id] if contribution is not None else []
        else:
            contribution_rows = db.execute(select(Contribution.id)).scalars().all()
            ids = list(contribution_rows)

        total_processed = 0
        total_paid = 0
        total_failed = 0
        total_payouts = 0
        for cid in ids:
            contribution = contribution_repository.get(db, cid)
            if contribution is None or contribution.status not in (
                ContributionStatus.ACTIVE,
                ContributionStatus.UPCOMING,
            ):
                continue
            self._reconcile_payout_dates(db, contribution)
            self._sync_schedule(db, contribution)
            members = contribution_member_repository.list_auto_wallet(db, cid)
            for member in members:
                due = [
                    s
                    for s in contribution.schedule
                    if s.member_id == member.id
                    and s.status != ScheduleStatus.PAID
                    and (s.due_date if s.due_date.tzinfo else s.due_date.replace(tzinfo=timezone.utc)) <= now
                ]
                for schedule in due[:1]:
                    total_processed += 1
                    ok = self._attempt_payment(db, contribution, member, schedule)
                    if ok:
                        total_paid += 1
                    else:
                        total_failed += 1

            total_payouts += self._process_rotation_payouts(db, contribution)["payouts"]

        return {
            "processed": total_processed,
            "paid": total_paid,
            "insufficient_funds": total_failed,
            "payouts": total_payouts,
        }


contribution_service = ContributionService()