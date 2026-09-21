from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import (
    AuditAction,
    AuditCategory,
    EnrollmentStatus,
    FundingMethod,
    NotificationType,
    SavingsPlanStatus,
    ScheduleStatus,
    TransactionType,
)
from app.models.savings_plan import SavingsPlan
from app.models.savings_plan_enrollment import SavingsPlanEnrollment
from app.models.savings_plan_schedule import SavingsPlanSchedule
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.savings_plan_repository import (
    savings_plan_enrollment_repository,
    savings_plan_repository,
    savings_plan_schedule_repository,
)
from app.repositories.user_repository import user_repository
from app.schemas.savings_plan import (
    SavingsPlanEnrollmentDetailOut,
    SavingsPlanEnrollmentOut,
    SavingsPlanOut,
    SavingsPlanScheduleOut,
)
from app.services.notification_service import notification_service
from app.services.wallet_service import make_reference, wallet_service
from app.utils.dates import (
    end_date_from_duration,
    period_count,
    period_dates,
    start_date_change_forbidden,
    start_date_in_past,
    utcnow,
)


class SavingsPlanService:
    def _base_fields(self, plan: SavingsPlan) -> dict:
        return {
            "id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "organization": plan.organization,
            "amount": plan.amount,
            "target_amount": plan.target_amount,
            "frequency": plan.frequency,
            "duration_months": plan.duration_months,
            "start_date": plan.start_date,
            "end_date": plan.end_date,
            "next_payment_date": plan.next_payment_date,
            "last_payment_date": plan.last_payment_date,
            "rounds": plan.rounds,
            "total_saved": plan.total_saved,
            "total_expected": plan.total_expected,
            "progress": plan.progress,
            "status": plan.status,
            "is_open": plan.is_open,
            "created_by": plan.created_by,
            "created_at": plan.created_at,
        }

    def _active_enrollments(self, plan: SavingsPlan) -> list[SavingsPlanEnrollment]:
        return [e for e in plan.enrollments if e.status == EnrollmentStatus.ACTIVE]

    def _build_out(
        self,
        plan: SavingsPlan,
        *,
        viewer_id: uuid.UUID | None = None,
        enrollment_id: uuid.UUID | None = None,
    ) -> SavingsPlanOut:
        active = self._active_enrollments(plan)
        viewer = None
        if viewer_id is not None:
            viewer = next((e for e in plan.enrollments if e.user_id == viewer_id), None)

        schedule_in: list[SavingsPlanSchedule] = []
        if enrollment_id is not None:
            schedule_in = [s for s in plan.schedule if s.enrollment_id == enrollment_id]

        return SavingsPlanOut(
            **self._base_fields(plan),
            enroll_count=len(active),
            enrollment=SavingsPlanEnrollmentOut.model_validate(viewer) if viewer is not None else None,
            schedule=[SavingsPlanScheduleOut.model_validate(s) for s in schedule_in],
        )

    def _build_list_out(
        self, plan: SavingsPlan, *, viewer_id: uuid.UUID | None = None
    ) -> SavingsPlanOut:
        """Lightweight list item: summary + active enrollments + viewer status."""
        viewer = None
        if viewer_id is not None:
            viewer = next(
                (e for e in plan.enrollments if e.user_id == viewer_id and e.status == EnrollmentStatus.ACTIVE),
                None,
            )
        return SavingsPlanOut(
            **self._base_fields(plan),
            enroll_count=len(self._active_enrollments(plan)),
            enrollment=SavingsPlanEnrollmentOut.model_validate(viewer) if viewer is not None else None,
            schedule=[],
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

    def _sync(self, db: Session, plan: SavingsPlan) -> None:
        plan.enrollments = savings_plan_enrollment_repository.list_for_plan(db, plan.id)
        plan.schedule = savings_plan_schedule_repository.list_for_plan(db, plan.id)

    def _recompute_totals(self, db: Session, plan: SavingsPlan) -> None:
        active = self._active_enrollments(plan)
        plan.total_saved = sum(e.total_saved for e in active)
        expected = plan.amount * plan.rounds * len(active)
        plan.total_expected = expected
        plan.progress = round(plan.total_saved / expected * 100) if expected else 0

        dues = [
            s.due_date
            for s in plan.schedule
            if s.enrollment_id in {e.id for e in active} and s.status != ScheduleStatus.PAID
        ]
        plan.next_payment_date = min(dues) if dues else None

        if active and not dues:
            plan.status = SavingsPlanStatus.COMPLETED
            if plan.end_date is None:
                paid = [s.paid_at for s in plan.schedule if s.paid_at is not None]
                plan.end_date = max(paid) if paid else plan.start_date

        db.flush()

    # ------------------------------------------------------------------ create

    def create(self, db: Session, *, user: User, payload) -> SavingsPlanOut:
        end_date = payload.end_date or end_date_from_duration(payload.start_date, payload.duration_months)
        if end_date < payload.start_date:
            raise AppException(
                message="End date must be on or after the start date.",
                status_code=422,
                error_code="INVALID_DATES",
            )

        if start_date_in_past(payload.start_date):
            raise AppException(
                message="Start date cannot be in the past.",
                status_code=422,
                error_code="START_DATE_IN_PAST",
            )

        rounds = period_count(payload.start_date, end_date, payload.frequency.value)

        plan = savings_plan_repository.create(
            db,
            created_by=user.id,
            name=payload.name,
            description=payload.description,
            organization=payload.organization,
            amount=payload.amount,
            target_amount=payload.target_amount,
            frequency=payload.frequency,
            duration_months=payload.duration_months,
            start_date=payload.start_date,
            end_date=end_date,
            rounds=max(rounds, 1),
            status=payload.status or SavingsPlanStatus.UPCOMING,
            is_open=payload.is_open,
        )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.SAVINGS,
            description=f"Created savings plan '{plan.name}'.",
            target=plan.name,
            target_id=plan.id,
        )

        notification_service.notify_all_users(
            db,
            title="New savings plan",
            message=f"{plan.name} is now available — {plan.amount}/{plan.frequency.value}.",
            type_=NotificationType.SAVINGS,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)
        return self._build_out(plan)

    # ------------------------------------------------------------------- read

    def get(self, db: Session, *, user: User, plan_id: uuid.UUID) -> SavingsPlanOut:
        plan = savings_plan_repository.get(db, plan_id)
        if plan is None:
            raise AppException(message="Savings plan not found.", status_code=404, error_code="SAVINGS_PLAN_NOT_FOUND")
        self._sync(db, plan)
        enrollment = savings_plan_enrollment_repository.get(db, plan_id, user.id) if user else None
        enrollment_id = (
            enrollment.id
            if enrollment is not None and enrollment.status == EnrollmentStatus.ACTIVE
            else None
        )
        return self._build_out(plan, viewer_id=user.id if user else None, enrollment_id=enrollment_id)

    def list_mine(self, db: Session, *, user: User, status=None, page: int = 1, page_size: int = 20):
        items, total = savings_plan_repository.list_mine(db, user.id, status=status, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item, viewer_id=user.id) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
        }

    def list_open(self, db: Session, *, page: int = 1, page_size: int = 20):
        items, total = savings_plan_repository.list_open(db, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
        }

    def list_all(self, db: Session, *, status=None, search: str | None = None, page: int = 1, page_size: int = 20):
        items, total = savings_plan_repository.list_all(db, status=status, search=search, page=page, page_size=page_size)
        return {
            "items": [self._build_list_out(item) for item in items],
            **self._paginated(total=total, page=page, page_size=page_size),
        }

    def enrollments(self, db: Session, *, plan_id: uuid.UUID) -> list[SavingsPlanEnrollmentDetailOut]:
        """Admin-facing enrollment list with member names and emails.

        Only active members are returned — removing a member takes them out of
        the plan (their enrollment is soft-removed; history is preserved, and
        an admin can re-add them afterwards).
        """
        plan = self._get_or_404(db, plan_id)
        rows = savings_plan_enrollment_repository.list_for_plan(db, plan.id)
        result: list[SavingsPlanEnrollmentDetailOut] = []
        for row in rows:
            if row.status != EnrollmentStatus.ACTIVE:
                continue
            user = user_repository.get(db, row.user_id)
            result.append(
                SavingsPlanEnrollmentDetailOut(
                    id=row.id,
                    user_id=row.user_id,
                    user_name=(
                        f"{user.first_name} {user.last_name}".strip()
                        if user is not None
                        else "Unknown user"
                    ),
                    user_email=user.email if user is not None else None,
                    total_saved=row.total_saved,
                    next_payment_date=row.next_payment_date,
                    status=row.status,
                    joined_at=row.joined_at,
                )
            )
        return result

    # ----------------------------------------------------------- admin update

    def _get_or_404(self, db: Session, plan_id: uuid.UUID) -> SavingsPlan:
        plan = savings_plan_repository.get(db, plan_id)
        if plan is None:
            raise AppException(message="Savings plan not found.", status_code=404, error_code="SAVINGS_PLAN_NOT_FOUND")
        return plan

    def update(self, db: Session, *, user: User, plan_id: uuid.UUID, payload) -> SavingsPlanOut:
        plan = self._get_or_404(db, plan_id)
        data = payload.model_dump(exclude_unset=True)

        if "duration_months" in data and data["duration_months"] is not None:
            start = data.get("start_date") or plan.start_date
            end = end_date_from_duration(start, data["duration_months"])
            data["end_date"] = end

        if "start_date" in data and data["start_date"] is not None:
            if start_date_change_forbidden(data["start_date"], plan.start_date):
                raise AppException(
                    message="Start date cannot be in the past.",
                    status_code=422,
                    error_code="START_DATE_IN_PAST",
                )

        for key, value in data.items():
            if value is not None:
                setattr(plan, key, value)

        if plan.end_date is not None and plan.end_date < plan.start_date:
            raise AppException(
                message="End date must be on or after the start date.",
                status_code=422,
                error_code="INVALID_DATES",
            )

        plan.rounds = max(period_count(plan.start_date, plan.end_date, plan.frequency.value), 1)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SAVINGS,
            description=f"Admin updated savings plan '{plan.name}'.",
            target=plan.name,
            target_id=plan.id,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)
        return self._build_out(plan)

    def delete(self, db: Session, *, user: User, plan_id: uuid.UUID) -> None:
        plan = self._get_or_404(db, plan_id)
        name = plan.name
        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.SAVINGS,
            description=f"Admin deleted savings plan '{name}'.",
            target=name,
            target_id=plan.id,
        )
        db.delete(plan)
        db.flush()

    # ------------------------------------------------------------- enrollment

    def _create_enrollment_schedules(
        self, db: Session, plan: SavingsPlan, enrollment: SavingsPlanEnrollment
    ) -> list[SavingsPlanSchedule]:
        dates = period_dates(plan.start_date, plan.frequency.value, plan.rounds)
        schedules = []
        for index, due in enumerate(dates):
            schedules.append(
                savings_plan_schedule_repository.create(
                    db,
                    plan_id=plan.id,
                    enrollment_id=enrollment.id,
                    period=due.strftime("%Y-%m"),
                    label=f"Payment {index + 1}",
                    due_date=due,
                    amount=plan.amount,
                )
            )
        return schedules

    def join(self, db: Session, *, user: User, plan_id: uuid.UUID) -> SavingsPlanOut:
        plan = self._get_or_404(db, plan_id)
        if not plan.is_open or plan.status not in (SavingsPlanStatus.UPCOMING, SavingsPlanStatus.ACTIVE):
            raise AppException(
                message="This savings plan is not open for joining.",
                status_code=400,
                error_code="NOT_ACCEPTING_MEMBERS",
            )

        if start_date_in_past(plan.start_date):
            raise AppException(
                message="This savings plan has already started and is not open for joining. Contact an admin to be added.",
                status_code=400,
                error_code="NOT_ACCEPTING_MEMBERS",
            )

        existing = savings_plan_enrollment_repository.get(db, plan_id, user.id)
        if existing is not None and existing.status == EnrollmentStatus.ACTIVE:
            raise AppException(
                message="You have already joined this savings plan.",
                status_code=400,
                error_code="ALREADY_ENROLLED",
            )

        if existing is not None:
            existing.status = EnrollmentStatus.ACTIVE
            enrollment = existing
        else:
            enrollment = savings_plan_enrollment_repository.create(db, plan_id=plan_id, user_id=user.id)

        if not savings_plan_schedule_repository.list_for_enrollment(db, plan_id, enrollment.id):
            schedules = self._create_enrollment_schedules(db, plan, enrollment)
            if schedules:
                savings_plan_enrollment_repository.set_next_payment_date(
                    db, enrollment, schedules[0].due_date
                )

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.CREATE,
            category=AuditCategory.SAVINGS,
            description=f"Joined savings plan '{plan.name}'.",
            target=plan.name,
            target_id=plan.id,
        )

        notification_service.create(
            db,
            user_id=user.id,
            title="Savings plan joined",
            message=f"You joined '{plan.name}'. Your first payment is scheduled.",
            type_=NotificationType.SAVINGS,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)
        return self._build_out(plan, viewer_id=user.id, enrollment_id=enrollment.id)

    def leave(self, db: Session, *, user: User, plan_id: uuid.UUID) -> None:
        plan = self._get_or_404(db, plan_id)
        enrollment = savings_plan_enrollment_repository.get(db, plan_id, user.id)
        if enrollment is None or enrollment.status == EnrollmentStatus.LEFT:
            raise AppException(
                message="You are not enrolled in this savings plan.",
                status_code=400,
                error_code="NOT_ENROLLED",
            )

        savings_plan_enrollment_repository.set_status(db, enrollment, EnrollmentStatus.LEFT)

        audit_log_repository.create(
            db,
            actor_id=user.id,
            actor_name=f"{user.first_name} {user.last_name}",
            actor_email=user.email,
            actor_role=user.role,
            action=AuditAction.DELETE,
            category=AuditCategory.SAVINGS,
            description=f"Left savings plan '{plan.name}'. History preserved.",
            target=plan.name,
            target_id=plan.id,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)

    # ------------------------------------------------------- admin membership

    def admin_add_member(
        self, db: Session, *, actor: User, plan_id: uuid.UUID, user_id: uuid.UUID
    ) -> SavingsPlanOut:
        plan = self._get_or_404(db, plan_id)

        member_user = user_repository.get(db, user_id)
        if member_user is None:
            raise AppException(message="User not found.", status_code=404, error_code="USER_NOT_FOUND")

        existing = savings_plan_enrollment_repository.get(db, plan_id, user_id)
        if existing is not None and existing.status == EnrollmentStatus.ACTIVE:
            raise AppException(
                message="This user has already joined this savings plan.",
                status_code=400,
                error_code="ALREADY_ENROLLED",
            )

        if existing is not None:
            existing.status = EnrollmentStatus.ACTIVE
            enrollment = existing
        else:
            enrollment = savings_plan_enrollment_repository.create(db, plan_id=plan_id, user_id=user_id)

        if not savings_plan_schedule_repository.list_for_enrollment(db, plan_id, enrollment.id):
            schedules = self._create_enrollment_schedules(db, plan, enrollment)
            if schedules:
                savings_plan_enrollment_repository.set_next_payment_date(
                    db, enrollment, schedules[0].due_date
                )
        else:
            pending = [
                s
                for s in savings_plan_schedule_repository.list_for_enrollment(
                    db, plan_id, enrollment.id
                )
                if s.status != ScheduleStatus.PAID
            ]
            savings_plan_enrollment_repository.set_next_payment_date(
                db, enrollment, pending[0].due_date if pending else None
            )

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.UPDATE,
            category=AuditCategory.SAVINGS,
            description=(
                f"Admin added {member_user.first_name} {member_user.last_name} "
                f"to savings plan '{plan.name}'."
            ),
            target=plan.name,
            target_id=plan.id,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)
        return self._build_out(plan)

    def admin_remove_member(
        self, db: Session, *, actor: User, plan_id: uuid.UUID, user_id: uuid.UUID
    ) -> SavingsPlanOut:
        plan = self._get_or_404(db, plan_id)

        enrollment = savings_plan_enrollment_repository.get(db, plan_id, user_id)
        if enrollment is None or enrollment.status == EnrollmentStatus.LEFT:
            raise AppException(
                message="This user is not enrolled in this savings plan.",
                status_code=400,
                error_code="NOT_ENROLLED",
            )

        has_payments = enrollment.total_saved > 0 or any(
            s.status == ScheduleStatus.PAID
            for s in savings_plan_schedule_repository.list_for_enrollment(
                db, plan_id, enrollment.id
            )
        )
        if has_payments:
            raise AppException(
                message=(
                    "This member has already started paying into the savings plan "
                    "and cannot be removed."
                ),
                status_code=400,
                error_code="MEMBER_HAS_PAYMENTS",
            )

        savings_plan_enrollment_repository.set_status(db, enrollment, EnrollmentStatus.LEFT)

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.DELETE,
            category=AuditCategory.SAVINGS,
            description=f"Admin removed a member from savings plan '{plan.name}'. History preserved.",
            target=plan.name,
            target_id=plan.id,
        )

        self._sync(db, plan)
        self._recompute_totals(db, plan)
        return self._build_out(plan)

    # --------------------------------------------------------------- payments

    def _attempt_payment(
        self,
        db: Session,
        plan: SavingsPlan,
        enrollment: SavingsPlanEnrollment,
        schedule: SavingsPlanSchedule,
        *,
        persist_failure: bool = False,
    ) -> bool:
        try:
            transaction = wallet_service.debit(
                db,
                user_id=enrollment.user_id,
                amount=schedule.amount,
                description=f"{plan.name} — {schedule.label}",
                reference=make_reference("SPL"),
                type_=TransactionType.SAVINGS,
                details={
                    "savings_plan_id": str(plan.id),
                    "schedule_id": schedule.id,
                    "enrollment_id": str(enrollment.id),
                    "method": FundingMethod.WALLET.value,
                },
            )
        except AppException as exc:
            if exc.error_code == "INSUFFICIENT_FUNDS":
                savings_plan_schedule_repository.record_failure(db, schedule, "insufficient_funds")
                if persist_failure:
                    db.commit()
                return False
            raise

        savings_plan_schedule_repository.mark_paid(
            db, schedule, transaction_id=transaction.id, paid_at=utcnow()
        )
        savings_plan_enrollment_repository.add_saved(db, enrollment, schedule.amount)
        plan.last_payment_date = schedule.due_date

        self._sync(db, plan)
        self._recompute_totals(db, plan)

        pending = [
            s
            for s in plan.schedule
            if s.enrollment_id == enrollment.id and s.status != ScheduleStatus.PAID
        ]
        savings_plan_enrollment_repository.set_next_payment_date(
            db, enrollment, pending[0].due_date if pending else None
        )

        owner = enrollment.user
        audit_log_repository.create(
            db,
            actor_id=enrollment.user_id,
            actor_name=f"{owner.first_name} {owner.last_name}".strip() if owner else "",
            actor_email=owner.email if owner else "",
            actor_role=owner.role if owner else None,
            action=AuditAction.CREATE,
            category=AuditCategory.SAVINGS,
            description=f"Paid {schedule.amount} for savings plan '{plan.name}' ({schedule.label}).",
            target=plan.name,
            target_id=plan.id,
            details={"schedule_id": schedule.id, "transaction_id": str(transaction.id)},
        )

        notification_service.create(
            db,
            user_id=enrollment.user_id,
            title="Savings payment recorded",
            message=f"You saved {schedule.amount} toward '{plan.name}' ({schedule.label}).",
            type_=NotificationType.SAVINGS,
        )
        return True

    def pay(
        self,
        db: Session,
        *,
        user: User,
        plan_id: uuid.UUID,
        schedule_id: int | None = None,
    ) -> SavingsPlanOut:
        plan = self._get_or_404(db, plan_id)
        enrollment = savings_plan_enrollment_repository.get(db, plan_id, user.id)
        if enrollment is None or enrollment.status != EnrollmentStatus.ACTIVE:
            raise AppException(
                message="You are not enrolled in this savings plan.",
                status_code=403,
                error_code="NOT_ENROLLED",
            )

        if schedule_id is not None:
            schedule = savings_plan_schedule_repository.get_locked(db, schedule_id)
            if (
                schedule is None
                or schedule.plan_id != plan_id
                or schedule.enrollment_id != enrollment.id
            ):
                raise AppException(
                    message="No upcoming payment due for this savings plan.",
                    status_code=400,
                    error_code="NO_DUE_PAYMENT",
                )
        else:
            schedule = savings_plan_schedule_repository.next_due_for_enrollment(
                db, plan_id, enrollment.id
            )
            if schedule is None:
                raise AppException(
                    message="No upcoming payment due for this savings plan.",
                    status_code=400,
                    error_code="NO_DUE_PAYMENT",
                )

        if schedule.status == ScheduleStatus.PAID:
            raise AppException(
                message="This payment has already been made.",
                status_code=400,
                error_code="ALREADY_PAID",
            )

        paid = self._attempt_payment(db, plan, enrollment, schedule, persist_failure=True)
        if not paid:
            raise AppException(
                message="Insufficient wallet balance to cover this savings payment.",
                status_code=400,
                error_code="INSUFFICIENT_FUNDS",
            )

        return self._build_out(plan, viewer_id=user.id, enrollment_id=enrollment.id)

    def run_automatic(self, db: Session, *, plan_id: uuid.UUID | None = None) -> dict:
        """Attempt to collect due savings payments from funded wallets.

        Safe to run from a scheduler. Payments short on funds are recorded on
        the schedule (failure_reason=insufficient_funds) and left PENDING.
        """
        now = utcnow()

        if plan_id is not None:
            plans = [p for p in [savings_plan_repository.get(db, plan_id)] if p is not None]
        else:
            rows = db.execute(select(SavingsPlan.id)).scalars().all()
            plans = [savings_plan_repository.get(db, pid) for pid in rows]

        total_processed = 0
        total_paid = 0
        total_failed = 0
        for plan in plans:
            if plan is None or plan.status not in (SavingsPlanStatus.UPCOMING, SavingsPlanStatus.ACTIVE):
                continue
            self._sync(db, plan)
            for enrollment in self._active_enrollments(plan):
                due = [
                    s
                    for s in plan.schedule
                    if s.enrollment_id == enrollment.id
                    and s.status != ScheduleStatus.PAID
                    and (s.due_date if s.due_date.tzinfo else s.due_date.replace(tzinfo=timezone.utc)) <= now
                ]
                for schedule in due[:1]:
                    total_processed += 1
                    ok = self._attempt_payment(db, plan, enrollment, schedule)
                    if ok:
                        total_paid += 1
                    else:
                        total_failed += 1

        db.flush()
        return {
            "processed": total_processed,
            "paid": total_paid,
            "insufficient_funds": total_failed,
        }


savings_plan_service = SavingsPlanService()