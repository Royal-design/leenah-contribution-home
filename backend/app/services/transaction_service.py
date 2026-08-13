import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.models.enums import AuditAction, AuditCategory, TransactionStatus, TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.repositories.audit_log_repository import audit_log_repository
from app.repositories.transaction_repository import transaction_repository
from app.schemas.transaction import TransactionOut


class TransactionService:
    def list_mine(self, db: Session, *, user: User, type_: TransactionType | None = None, status: TransactionStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = transaction_repository.list_mine(db, user.id, type_=type_, status=status, page=page, page_size=page_size)
        return {
            "items": [TransactionOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def list_all(self, db: Session, *, type_: TransactionType | None = None, status: TransactionStatus | None = None, page: int = 1, page_size: int = 20):
        items, total = transaction_repository.list_all(db, type_=type_, status=status, page=page, page_size=page_size)
        return {
            "items": [TransactionOut.model_validate(item) for item in items],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total else 0,
        }

    def get(self, db: Session, *, user: User, transaction_id: uuid.UUID) -> Transaction:
        transaction = transaction_repository.get(db, transaction_id)
        if transaction is None:
            raise AppException(message="Transaction not found.", status_code=404, error_code="TRANSACTION_NOT_FOUND")
        if transaction.user_id != user.id:
            raise AppException(message="Transaction not found.", status_code=404, error_code="TRANSACTION_NOT_FOUND")
        return transaction

    def revert(self, db: Session, *, actor: User, transaction_id: uuid.UUID) -> Transaction:
        transaction = transaction_repository.get(db, transaction_id)
        if transaction is None:
            raise AppException(message="Transaction not found.", status_code=404, error_code="TRANSACTION_NOT_FOUND")
        if transaction.status == TransactionStatus.REVERTED:
            raise AppException(message="Transaction is already reverted.", status_code=400, error_code="ALREADY_REVERTED")
        if transaction.status != TransactionStatus.SUCCESSFUL:
            raise AppException(
                message="Only successful transactions can be reverted.",
                status_code=400,
                error_code="CANNOT_REVERT",
            )

        transaction.status = TransactionStatus.REVERTED
        db.flush()

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.REVERT,
            category=AuditCategory.TRANSACTION,
            description=f"Reverted {transaction.type} transaction {transaction.reference}.",
            target=transaction.reference,
            target_id=transaction.id,
            details={"amount": transaction.amount},
        )
        return transaction

    def delete(self, db: Session, *, actor: User, transaction_id: uuid.UUID) -> None:
        transaction = transaction_repository.get(db, transaction_id)
        if transaction is None:
            raise AppException(message="Transaction not found.", status_code=404, error_code="TRANSACTION_NOT_FOUND")
        if transaction.status not in (TransactionStatus.PENDING, TransactionStatus.FAILED):
            raise AppException(
                message="Only pending or failed transactions can be deleted.",
                status_code=400,
                error_code="CANNOT_DELETE",
            )

        reference = transaction.reference
        details = {"type": transaction.type.value, "amount": transaction.amount, "status": transaction.status.value}

        audit_log_repository.create(
            db,
            actor_id=actor.id,
            actor_name=f"{actor.first_name} {actor.last_name}",
            actor_email=actor.email,
            actor_role=actor.role,
            action=AuditAction.DELETE,
            category=AuditCategory.TRANSACTION,
            description=f"Deleted {transaction.type} transaction {reference}.",
            target=reference,
            target_id=transaction.id,
            details=details,
        )
        db.delete(transaction)
        db.flush()


transaction_service = TransactionService()