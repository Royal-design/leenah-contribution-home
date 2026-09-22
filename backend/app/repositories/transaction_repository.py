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
        **extra,
    ) -> Transaction:
        transaction = Transaction(
            user_id=user_id,
            type=type_,
            status=status,
            amount=amount,
            description=description,
            reference=reference,
            details=details or {},
            currency=extra.pop("currency", "NGN"),
            source=extra.pop("source", None),
            gross_amount=extra.pop("gross_amount", None),
            commission_rate=extra.pop("commission_rate", None),
            commission_type=extra.pop("commission_type", None),
            commission_amount=extra.pop("commission_amount", None),
            fee_amount=extra.pop("fee_amount", None),
            net_amount=extra.pop("net_amount", None),
            related_savings_plan_id=extra.pop("related_savings_plan_id", None),
            related_contribution_id=extra.pop("related_contribution_id", None),
            related_withdrawal_id=extra.pop("related_withdrawal_id", None),
            related_emergency_request_id=extra.pop("related_emergency_request_id", None),
            completed_at=extra.pop("completed_at", None),
            approved_by=extra.pop("approved_by", None),
            approved_at=extra.pop("approved_at", None),
            failure_reason=extra.pop("failure_reason", None),
        )
        if extra:
            raise TypeError(f"Unexpected transaction fields: {', '.join(extra)}")
        db.add(transaction)
        db.flush()
        return transaction

    def get(self, db: Session, transaction_id: uuid.UUID) -> Transaction | None:
        return db.get(Transaction, transaction_id)

    def get_by_reference(self, db: Session, reference: str) -> Transaction | None:
        return db.execute(
            select(Transaction).where(Transaction.reference == reference)
        ).scalar_one_or_none()

    def update_status(self, db: Session, transaction_id: uuid.UUID, status: TransactionStatus) -> None:
        transaction = db.get(Transaction, transaction_id)
        if transaction is not None:
            transaction.status = status
            db.flush()

    def update_details(self, db: Session, transaction_id: uuid.UUID, details: dict | None) -> None:
        transaction = db.get(Transaction, transaction_id)
        if transaction is not None and details is not None:
            transaction.details = {**(transaction.details or {}), **details}
            db.flush()

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

    def count_by_status(self, db: Session, status: TransactionStatus) -> int:
        return db.execute(
            select(func.count(Transaction.id)).where(Transaction.status == status)
        ).scalar_one()

    # ------------------------------------------------------ commission ledger

    def list_commissioned(
        self,
        db: Session,
        *,
        type_: TransactionType | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        conditions = [
            Transaction.commission_amount.is_not(None),
            Transaction.commission_amount > 0,
            Transaction.status == TransactionStatus.SUCCESSFUL,
        ]
        if type_ is not None:
            conditions.append(Transaction.type == type_)

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

    def sum_commission(self, db: Session, *, since=None) -> int:
        query = select(
            func.coalesce(func.sum(func.coalesce(Transaction.commission_amount, 0) + func.coalesce(Transaction.fee_amount, 0)), 0)
        ).where(Transaction.status == TransactionStatus.SUCCESSFUL)
        if since is not None:
            query = query.where(Transaction.date >= since)
        return db.execute(query).scalar_one()

    def commission_summary(self, db: Session, *, since=None) -> list[dict]:
        """Commission revenue grouped by transaction type and by source."""
        conditions = [
            Transaction.commission_amount.is_not(None),
            Transaction.commission_amount > 0,
            Transaction.status == TransactionStatus.SUCCESSFUL,
        ]
        if since is not None:
            conditions.append(Transaction.date >= since)

        by_type_rows = db.execute(
            select(
                Transaction.type,
                func.coalesce(func.sum(func.coalesce(Transaction.commission_amount, 0) + func.coalesce(Transaction.fee_amount, 0)), 0),
            )
            .where(*conditions)
            .group_by(Transaction.type)
        ).all()

        by_source_rows = db.execute(
            select(
                Transaction.source,
                func.coalesce(func.sum(func.coalesce(Transaction.commission_amount, 0) + func.coalesce(Transaction.fee_amount, 0)), 0),
            )
            .where(*conditions)
            .group_by(Transaction.source)
        ).all()

        return {
            "by_type": [{"type": t.value, "total": int(v)} for t, v in by_type_rows],
            "by_source": [{"source": s, "total": int(v)} for s, v in by_source_rows],
        }


transaction_repository = TransactionRepository()