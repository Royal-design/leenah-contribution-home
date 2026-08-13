from datetime import datetime
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.contribution import Contribution
from app.models.contribution_member import ContributionMember
from app.models.contribution_payout import ContributionPayout
from app.models.contribution_schedule import ContributionSchedule
from app.models.enums import (
    ContributionStatus,
    FundingMethod,
    MemberStatus,
    PayoutStatus,
    ScheduleStatus,
)


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
        member_ids = select(ContributionMember.contribution_id).where(
            ContributionMember.user_id == user_id,
            ContributionMember.status == MemberStatus.ACTIVE,
        )
        conditions = [or_(Contribution.id.in_(member_ids), Contribution.created_by == user_id)]

        base = select(Contribution).options(selectinload(Contribution.members))
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
        conditions = [
            Contribution.is_open.is_(True),
            Contribution.status.in_([ContributionStatus.UPCOMING, ContributionStatus.ACTIVE]),
        ]
        base = select(Contribution).options(selectinload(Contribution.members))
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

        base = select(Contribution).options(selectinload(Contribution.members))
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

    def get_by_id(self, db: Session, member_id: uuid.UUID) -> ContributionMember | None:
        return db.get(ContributionMember, member_id)

    def count_members(self, db: Session, contribution_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count(ContributionMember.id)).where(ContributionMember.contribution_id == contribution_id)
        ).scalar_one()

    def count_active(self, db: Session, contribution_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count(ContributionMember.id)).where(
                ContributionMember.contribution_id == contribution_id,
                ContributionMember.status == MemberStatus.ACTIVE,
            )
        ).scalar_one()

    def create(
        self,
        db: Session,
        *,
        contribution_id: uuid.UUID,
        user_id: uuid.UUID,
        display_name: str,
        avatar: str | None,
        position: int,
        payout_position: int | None = None,
        funding_method: FundingMethod = FundingMethod.WALLET,
        automatic: bool = True,
    ) -> ContributionMember:
        member = ContributionMember(
            contribution_id=contribution_id,
            user_id=user_id,
            display_name=display_name,
            avatar=avatar,
            position=position,
            payout_position=payout_position or position,
            funding_method=funding_method,
            automatic=automatic,
        )
        db.add(member)
        db.flush()
        return member

    def set_status(self, db: Session, member: ContributionMember, status: MemberStatus) -> None:
        member.status = status
        if status != MemberStatus.ACTIVE:
            member.next_payment_date = None
        db.flush()

    def set_funding(self, db: Session, member: ContributionMember, *, funding_method: FundingMethod, automatic: bool) -> None:
        member.funding_method = funding_method
        member.automatic = automatic
        db.flush()

    def set_next_payment_date(self, db: Session, member: ContributionMember, value: datetime | None) -> None:
        member.next_payment_date = value
        db.flush()

    def add_contribution(self, db: Session, member: ContributionMember, amount: int) -> None:
        member.total_contributed += amount
        db.flush()

    def delete(self, db: Session, member: ContributionMember) -> None:
        db.delete(member)
        db.flush()

    def list_members(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionMember]:
        return list(
            db.execute(
                select(ContributionMember).where(ContributionMember.contribution_id == contribution_id).order_by(ContributionMember.position)
            ).scalars().all()
        )

    def list_active(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionMember]:
        return list(
            db.execute(
                select(ContributionMember)
                .where(
                    ContributionMember.contribution_id == contribution_id,
                    ContributionMember.status == MemberStatus.ACTIVE,
                )
                .order_by(ContributionMember.position)
            ).scalars().all()
        )

    def list_auto_wallet(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionMember]:
        return list(
            db.execute(
                select(ContributionMember)
                .where(
                    ContributionMember.contribution_id == contribution_id,
                    ContributionMember.status == MemberStatus.ACTIVE,
                    ContributionMember.automatic.is_(True),
                    ContributionMember.funding_method == FundingMethod.WALLET,
                )
                .order_by(ContributionMember.position)
            ).scalars().all()
        )


class ContributionScheduleRepository:
    def create(
        self,
        db: Session,
        *,
        contribution_id: uuid.UUID,
        member_id: uuid.UUID | None,
        period: str,
        label: str | None,
        due_date: datetime,
        amount: int,
    ) -> ContributionSchedule:
        schedule = ContributionSchedule(
            contribution_id=contribution_id,
            member_id=member_id,
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

    def get_locked(self, db: Session, schedule_id: int) -> ContributionSchedule | None:
        return db.execute(
            select(ContributionSchedule).where(ContributionSchedule.id == schedule_id).with_for_update()
        ).scalar_one_or_none()

    def list_schedule(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionSchedule]:
        return list(
            db.execute(
                select(ContributionSchedule).where(ContributionSchedule.contribution_id == contribution_id).order_by(ContributionSchedule.due_date)
            ).scalars().all()
        )

    def list_for_member(self, db: Session, contribution_id: uuid.UUID, member_id: uuid.UUID) -> list[ContributionSchedule]:
        return list(
            db.execute(
                select(ContributionSchedule)
                .where(
                    ContributionSchedule.contribution_id == contribution_id,
                    ContributionSchedule.member_id == member_id,
                )
                .order_by(ContributionSchedule.due_date)
            ).scalars().all()
        )

    def next_due_for_member(self, db: Session, contribution_id: uuid.UUID, member_id: uuid.UUID) -> ContributionSchedule | None:
        return db.execute(
            select(ContributionSchedule)
            .where(
                ContributionSchedule.contribution_id == contribution_id,
                ContributionSchedule.member_id == member_id,
                ContributionSchedule.status != ScheduleStatus.PAID,
            )
            .order_by(ContributionSchedule.due_date)
            .with_for_update()
            .limit(1)
        ).scalar_one_or_none()

    def list_pending_for_member(self, db: Session, contribution_id: uuid.UUID, member_id: uuid.UUID) -> list[ContributionSchedule]:
        return list(
            db.execute(
                select(ContributionSchedule)
                .where(
                    ContributionSchedule.contribution_id == contribution_id,
                    ContributionSchedule.member_id == member_id,
                    ContributionSchedule.status != ScheduleStatus.PAID,
                )
                .order_by(ContributionSchedule.due_date)
            ).scalars().all()
        )

    def list_due(self, db: Session, contribution_id: uuid.UUID, cutoff: datetime) -> list[ContributionSchedule]:
        return list(
            db.execute(
                select(ContributionSchedule)
                .where(
                    ContributionSchedule.contribution_id == contribution_id,
                    ContributionSchedule.member_id.is_not(None),
                    ContributionSchedule.status != ScheduleStatus.PAID,
                    ContributionSchedule.due_date <= cutoff,
                )
                .order_by(ContributionSchedule.due_date)
            ).scalars().all()
        )

    def mark_paid(self, db: Session, schedule: ContributionSchedule, *, transaction_id: uuid.UUID, paid_at: datetime) -> None:
        schedule.status = ScheduleStatus.PAID
        schedule.transaction_id = transaction_id
        schedule.paid_at = paid_at
        schedule.attempt_count += 1
        schedule.failure_reason = None
        db.flush()

    def record_failure(self, db: Session, schedule: ContributionSchedule, reason: str) -> None:
        schedule.attempt_count += 1
        schedule.failure_reason = reason
        db.flush()


class ContributionPayoutRepository:
    def create(
        self,
        db: Session,
        *,
        contribution_id: uuid.UUID,
        member_id: uuid.UUID,
        round_number: int,
        scheduled_date: datetime,
        amount: int,
    ) -> ContributionPayout:
        payout = ContributionPayout(
            contribution_id=contribution_id,
            member_id=member_id,
            round_number=round_number,
            scheduled_date=scheduled_date,
            amount=amount,
        )
        db.add(payout)
        db.flush()
        return payout

    def list_for_contribution(self, db: Session, contribution_id: uuid.UUID) -> list[ContributionPayout]:
        return list(
            db.execute(
                select(ContributionPayout)
                .where(ContributionPayout.contribution_id == contribution_id)
                .order_by(ContributionPayout.round_number)
            ).scalars().all()
        )

    def list_for_member(self, db: Session, contribution_id: uuid.UUID, member_id: uuid.UUID) -> list[ContributionPayout]:
        return list(
            db.execute(
                select(ContributionPayout)
                .where(
                    ContributionPayout.contribution_id == contribution_id,
                    ContributionPayout.member_id == member_id,
                )
                .order_by(ContributionPayout.round_number)
            ).scalars().all()
        )


contribution_repository = ContributionRepository()
contribution_member_repository = ContributionMemberRepository()
contribution_schedule_repository = ContributionScheduleRepository()
contribution_payout_repository = ContributionPayoutRepository()