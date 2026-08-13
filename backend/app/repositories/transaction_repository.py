import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import TransactionStatus, TransactionType
from app.models.transaction import Transaction


class TransactionRepository:
    def create(
        self,
        db: Session,
        *,
        user_id: uuid.UUID,
        type_: TransactionType,
        status: TransactionStatus,
        amount: int,
        description: str,
        reference: str,
        details: dict | None = None,
    ) -> Transaction:
        transaction = Transaction(
            user_id=user_id,
            type=type_,
            status=status,
            amount=amount,
            description=description,
            reference=reference,
            details=details,
        )
        db.add(transaction)
        db.flush()
        return transaction

    def get(self, db: Session, transaction_id: uuid.UUID) -> Transaction | None:
        return db.get(Transaction, transaction_id)

    def list_mine(
        self,
        db: Session,
        user_id: uuid.UUID,
        *,
        type_: TransactionType | None = None,
        status: TransactionStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        conditions = [Transaction.user_id == user_id]
        if type_ is not None:
            conditions.append(Transaction.type == type_)
        if status is not None:
            conditions.append(Transaction.status == status)

        base = select(Transaction)
        count_q = select(func.count(Transaction.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Transaction.date.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def list_all(
        self,
        db: Session,
        *,
        type_: TransactionType | None = None,
        status: TransactionStatus | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        conditions = []
        if type_ is not None:
            conditions.append(Transaction.type == type_)
        if status is not None:
            conditions.append(Transaction.status == status)

        base = select(Transaction)
        count_q = select(func.count(Transaction.id))
        for c in conditions:
            base = base.where(c)
            count_q = count_q.where(c)

        total = db.execute(count_q).scalar_one()
        items = list(
            db.execute(base.order_by(Transaction.date.desc()).offset((page - 1) * page_size).limit(page_size)).scalars().all()
        )
        return items, total

    def sum_amount(self, db: Session, *, since=None) -> int:
        query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(Transaction.status == TransactionStatus.SUCCESSFUL)
        if since is not None:
            query = query.where(Transaction.date >= since)
        return db.execute(query).scalar_one()


transaction_repository = TransactionRepository()