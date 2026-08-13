from datetime import datetime
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.contribution_member import ContributionMember
from app.models.contribution_schedule import ContributionSchedule
from app.models.enums import ContributionStatus, ScheduleStatus


class ContributionRepository:
    def create(self, db: Session, *, created_by: uuid.UUID, **fields) -> Contribution:
        contribution = Contribution(created_by=created_by, **fields)
        db.add(contribution)
        db.flush()
        return contribution

    def get(self, db: Session, contribution_id: uuid.UUID) -> Contribution | None:
        return db.get(Contribution, contribution_id)

    def list_mine(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        status: ContributionStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Contribution], int]:
        member_ids = select(ContributionMember.contribution_id).where(ContributionMember.user_id == user_id)
        conditions = [or_(Contribution.id.in_(member_ids), Contribution.created_by == user_id)]

        base = select(Contribution)
        count_q = select(func.count(Contribution.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        if status is not None:
            base = base.where(Contribution.status == status)
            count_q = count_q.where(Contribution.status == status)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Contribution.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def list_open(self, db: Session, *, page: int = 1, page_size: int = 20) -> tuple[list[Contribution], int]:
        conditions = [Contribution.is_open.is_(True), Contribution.status == ContributionStatus.UPCOMING]
        base = select(Contribution)
        count_q = select(func.count(Contribution.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Contribution.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def list_all(
        self,
        db: Session,
        *,
        status: ContributionStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Contribution], int]:
        conditions = []
        if status is not None:
            conditions.append(Contribution.status == status)
        if search:
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Contribution.name.ilike(term),
                    Contribution.organization.ilike(term),
                )
            )

        base = select(Contribution)
        count_q = select(func.count(Contribution.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Contribution.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def count_active(self, db: Session) -> int:
        return db.execute(select(func.count(Contribution.id)).where(Contribution.status == ContributionStatus.ACTIVE)).scalar_one()


class ContributionMemberRepository:
    def get(self, db: Session, contribution_id: uuid.UUID, user_id: uuid.UUID) -> ContributionMember | None:
        return db.execute(
            select(ContributionMember).where(
                ContributionMember.contribution_id == contribution_id,
                ContributionMember.user_id == user_id,
            )
        ).scalar_one_or_none()

    def count_members(self, db: Session, contribution_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count(ContributionMember.id)).where(ContributionMember.contribution_id == contribution_id)
        ).scalar_one()

    def create(self, db: Session, *, contribution_id: uuid.UUID, user_id: uuid.UUID, display_name: str, avatar: str | None, position: int) -> ContributionMember:
        member = ContributionMember(
            contribution_id=contribution_id,
            user_id=user_id,
            display_name=display_name,
            avatar=avatar,
            position=position,
        )
        db.add(member)
        db.flush()
        return member

    def delete(self, db: Session, member: ContributionMember) -> None:
        db.delete(member)
        db.flush()

    def list_members(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionMember]:
        return list(
            db.execute(
                select(ContributionMember).where(ContributionMember.contribution_id == contribution_id).order_by(ContributionMember.position)
            ).scalars().all()
        )


class ContributionScheduleRepository:
    def create(self, db: Session, *, contribution_id: uuid.UUID, period: str, label: str | None, due_date: datetime, amount: int) -> ContributionSchedule:
        schedule = ContributionSchedule(
            contribution_id=contribution_id,
            period=period,
            label=label,
            due_date=due_date,
            amount=amount,
        )
        db.add(schedule)
        db.flush()
        return schedule

    def get(self, db: Session, schedule_id: int) -> ContributionSchedule | None:
        return db.get(ContributionSchedule, schedule_id)

    def list_schedule(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionSchedule]:
        return list(
            db.execute(
                select(ContributionSchedule).where(ContributionSchedule.contribution_id == contribution_id).order_by(ContributionSchedule.due_date)
            ).scalars().all()
        )

    def next_pending(self, db: Session, contribution_id: uuid.UUID) -> ContributionSchedule | None:
        return db.execute(
            select(ContributionSchedule)
            .where(ContributionSchedule.contribution_id == contribution_id)
            .order_by(ContributionSchedule.due_date)
            .limit(1)
        ).scalar_one_or_none()

    def mark_paid(self, db: Session, schedule: ContributionSchedule) -> None:
        schedule.status = ScheduleStatus.PAID
        db.flush()


contribution_repository = ContributionRepository()
contribution_member_repository = ContributionMemberRepository()
contribution_schedule_repository = ContributionScheduleRepository()