from datetime import datetime
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.enums import EnrollmentStatus, ScheduleStatus, SavingsPlanStatus
from app.models.savings_plan import SavingsPlan
from app.models.savings_plan_enrollment import SavingsPlanEnrollment
from app.models.savings_plan_schedule import SavingsPlanSchedule

OPEN_STATUSES = (SavingsPlanStatus.UPCOMING, SavingsPlanStatus.ACTIVE)


class SavingsPlanRepository:
    def create(self, db: Session, *, created_by: uuid.UUID, **fields) -> SavingsPlan:
        plan = SavingsPlan(created_by=created_by, **fields)
        db.add(plan)
        db.flush()
        return plan

    def get(self, db: Session, plan_id: uuid.UUID) -> SavingsPlan | None:
        return db.get(SavingsPlan, plan_id)

    def list_mine(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        status: SavingsPlanStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SavingsPlan], int]:
        enrollment_ids = select(SavingsPlanEnrollment.plan_id).where(
            SavingsPlanEnrollment.user_id == user_id,
            SavingsPlanEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        conditions = [SavingsPlan.id.in_(enrollment_ids)]

        base = select(SavingsPlan).options(selectinload(SavingsPlan.enrollments))
        count_q = select(func.count(SavingsPlan.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        if status is not None:
            base = base.where(SavingsPlan.status == status)
            count_q = count_q.where(SavingsPlan.status == status)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(
                base.order_by(SavingsPlan.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).scalars().all()
        )
        return items, total

    def list_open(self, db: Session, *, page: int = 1, page_size: int = 20) -> tuple[list[SavingsPlan], int]:
        conditions = [SavingsPlan.is_open.is_(True), SavingsPlan.status.in_(OPEN_STATUSES)]
        base = select(SavingsPlan).options(selectinload(SavingsPlan.enrollments))
        count_q = select(func.count(SavingsPlan.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(
                base.order_by(SavingsPlan.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).scalars().all()
        )
        return items, total

    def list_all(
        self,
        db: Session,
        *,
        status: SavingsPlanStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SavingsPlan], int]:
        conditions = []
        if status is not None:
            conditions.append(SavingsPlan.status == status)
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    SavingsPlan.name.ilike(term),
                    SavingsPlan.organization.ilike(term),
                )
            )

        base = select(SavingsPlan).options(selectinload(SavingsPlan.enrollments))
        count_q = select(func.count(SavingsPlan.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(
                base.order_by(SavingsPlan.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            ).scalars().all()
        )
        return items, total

    def count_active(self, db: Session) -> int:
        return db.execute(
            select(func.count(SavingsPlan.id)).where(SavingsPlan.status == SavingsPlanStatus.ACTIVE)
        ).scalar_one()

    def total_saved(self, db: Session) -> int:
        return db.execute(
            select(func.coalesce(func.sum(SavingsPlanEnrollment.total_saved), 0))
        ).scalar_one()


class SavingsPlanEnrollmentRepository:
    def get(self, db: Session, plan_id: uuid.UUID, user_id: uuid.UUID) -> SavingsPlanEnrollment | None:
        return db.execute(
            select(SavingsPlanEnrollment).where(
                SavingsPlanEnrollment.plan_id == plan_id,
                SavingsPlanEnrollment.user_id == user_id,
            )
        ).scalar_one_or_none()

    def get_by_id(self, db: Session, enrollment_id: uuid.UUID) -> SavingsPlanEnrollment | None:
        return db.get(SavingsPlanEnrollment, enrollment_id)

    def count_active(self, db: Session, plan_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count(SavingsPlanEnrollment.id)).where(
                SavingsPlanEnrollment.plan_id == plan_id,
                SavingsPlanEnrollment.status == EnrollmentStatus.ACTIVE,
            )
        ).scalar_one()

    def create(self, db: Session, *, plan_id: uuid.UUID, user_id: uuid.UUID) -> SavingsPlanEnrollment:
        enrollment = SavingsPlanEnrollment(plan_id=plan_id, user_id=user_id)
        db.add(enrollment)
        db.flush()
        return enrollment

    def set_status(self, db: Session, enrollment: SavingsPlanEnrollment, status: EnrollmentStatus) -> None:
        enrollment.status = status
        if status != EnrollmentStatus.ACTIVE:
            enrollment.next_payment_date = None
        db.flush()

    def set_next_payment_date(self, db: Session, enrollment: SavingsPlanEnrollment, value: datetime | None) -> None:
        enrollment.next_payment_date = value
        db.flush()

    def add_saved(self, db: Session, enrollment: SavingsPlanEnrollment, amount: int) -> None:
        enrollment.total_saved += amount
        db.flush()

    def list_for_plan(self, db: Session, plan_id: uuid.UUID) -> list[SavingsPlanEnrollment]:
        return list(
            db.execute(
                select(SavingsPlanEnrollment)
                .where(SavingsPlanEnrollment.plan_id == plan_id)
                .order_by(SavingsPlanEnrollment.joined_at)
            ).scalars().all()
        )


class SavingsPlanScheduleRepository:
    def create(
        self,
        db: Session,
        *,
        plan_id: uuid.UUID,
        enrollment_id: uuid.UUID,
        period: str,
        label: str | None,
        due_date: datetime,
        amount: int,
    ) -> SavingsPlanSchedule:
        schedule = SavingsPlanSchedule(
            plan_id=plan_id,
            enrollment_id=enrollment_id,
            period=period,
            label=label,
            due_date=due_date,
            amount=amount,
        )
        db.add(schedule)
        db.flush()
        return schedule

    def get_locked(self, db: Session, schedule_id: int) -> SavingsPlanSchedule | None:
        return db.execute(
            select(SavingsPlanSchedule).where(SavingsPlanSchedule.id == schedule_id).with_for_update()
        ).scalar_one_or_none()

    def list_for_enrollment(self, db: Session, plan_id: uuid.UUID, enrollment_id: uuid.UUID) -> list[SavingsPlanSchedule]:
        return list(
            db.execute(
                select(SavingsPlanSchedule)
                .where(
                    SavingsPlanSchedule.plan_id == plan_id,
                    SavingsPlanSchedule.enrollment_id == enrollment_id,
                )
                .order_by(SavingsPlanSchedule.due_date)
            ).scalars().all()
        )

    def next_due_for_enrollment(
        self, db: Session, plan_id: uuid.UUID, enrollment_id: uuid.UUID
    ) -> SavingsPlanSchedule | None:
        return db.execute(
            select(SavingsPlanSchedule)
            .where(
                SavingsPlanSchedule.plan_id == plan_id,
                SavingsPlanSchedule.enrollment_id == enrollment_id,
                SavingsPlanSchedule.status != ScheduleStatus.PAID,
            )
            .order_by(SavingsPlanSchedule.due_date)
            .with_for_update()
            .limit(1)
        ).scalar_one_or_none()

    def list_pending_for_enrollment(
        self, db: Session, plan_id: uuid.UUID, enrollment_id: uuid.UUID
    ) -> list[SavingsPlanSchedule]:
        return list(
            db.execute(
                select(SavingsPlanSchedule)
                .where(
                    SavingsPlanSchedule.plan_id == plan_id,
                    SavingsPlanSchedule.enrollment_id == enrollment_id,
                    SavingsPlanSchedule.status != ScheduleStatus.PAID,
                )
                .order_by(SavingsPlanSchedule.due_date)
            ).scalars().all()
        )

    def list_due(self, db: Session, cutoff: datetime) -> list[SavingsPlanSchedule]:
        return list(
            db.execute(
                select(SavingsPlanSchedule)
                .where(
                    SavingsPlanSchedule.status != ScheduleStatus.PAID,
                    SavingsPlanSchedule.due_date <= cutoff,
                )
                .order_by(SavingsPlanSchedule.due_date)
            ).scalars().all()
        )

    def list_for_plan(self, db: Session, plan_id: uuid.UUID) -> list[SavingsPlanSchedule]:
        return list(
            db.execute(
                select(SavingsPlanSchedule)
                .where(SavingsPlanSchedule.plan_id == plan_id)
                .order_by(SavingsPlanSchedule.due_date)
            ).scalars().all()
        )

    def mark_paid(self, db: Session, schedule: SavingsPlanSchedule, *, transaction_id: uuid.UUID, paid_at: datetime) -> None:
        schedule.status = ScheduleStatus.PAID
        schedule.transaction_id = transaction_id
        schedule.paid_at = paid_at
        schedule.attempt_count += 1
        schedule.failure_reason = None
        db.flush()

    def record_failure(self, db: Session, schedule: SavingsPlanSchedule, reason: str) -> None:
        schedule.attempt_count += 1
        schedule.failure_reason = reason
        db.flush()


savings_plan_repository = SavingsPlanRepository()
savings_plan_enrollment_repository = SavingsPlanEnrollmentRepository()
savings_plan_schedule_repository = SavingsPlanScheduleRepository()