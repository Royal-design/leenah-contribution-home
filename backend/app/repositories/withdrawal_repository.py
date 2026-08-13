import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import WithdrawalStatus
from app.models.withdrawal import Withdrawal


class WithdrawalRepository:
    def create(self, db: Session, *, user_id: uuid.UUID, **fields) -> Withdrawal:
        withdrawal = Withdrawal(user_id=user_id, **fields)
        db.add(withdrawal)
        db.flush()
        return withdrawal

    def get(self, db: Session, withdrawal_id: uuid.UUID) -> Withdrawal | None:
        return db.get(Withdrawal, withdrawal_id)

    def list_mine(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        status: WithdrawalStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Withdrawal], int]:
        conditions = [Withdrawal.user_id == user_id]
        if status is not None:
            conditions.append(Withdrawal.status == status)

        base = select(Withdrawal)
        count_q = select(func.count(Withdrawal.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Withdrawal.requested_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def list_all(
        self,
        db: Session,
        *,
        status: WithdrawalStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Withdrawal], int]:
        conditions = []
        if status is not None:
            conditions.append(Withdrawal.status == status)

        base = select(Withdrawal)
        count_q = select(func.count(Withdrawal.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Withdrawal.requested_at.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def count_pending(self, db: Session) -> int:
        return db.execute(
            select(func.count(Withdrawal.id)).where(Withdrawal.status == WithdrawalStatus.PENDING)
        ).scalar_one()


withdrawal_repository = WithdrawalRepository()