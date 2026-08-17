"""add paystack payment architecture

Revision ID: 7f3d9c2a1b5e
Revises: 6db421253958
Create Date: 2026-08-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "7f3d9c2a1b5e"
down_revision = "6db421253958"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- enum additions ------------------------------------------------------
    op.execute("ALTER TYPE withdrawalstatus ADD VALUE IF NOT EXISTS 'PROCESSING'")
    op.execute("ALTER TYPE withdrawalstatus ADD VALUE IF NOT EXISTS 'FAILED'")
    op.execute("ALTER TYPE withdrawalstatus ADD VALUE IF NOT EXISTS 'REVERSED'")

    # --- users: Paystack customer identifiers -------------------------------
    op.add_column("users", sa.Column("paystack_customer_code", sa.String(), nullable=True))
    op.add_column("users", sa.Column("paystack_customer_id", sa.String(), nullable=True))
    op.create_index("ix_users_paystack_customer_code", "users", ["paystack_customer_code"], unique=True)

    # --- savings_accounts: reserved balance ---------------------------------
    op.add_column("savings_accounts", sa.Column("reserved", sa.Integer(), nullable=False, server_default="0"))
    op.create_check_constraint("ck_savings_balance_nonneg", "savings_accounts", "balance >= 0")
    op.create_check_constraint("ck_savings_reserved_nonneg", "savings_accounts", "reserved >= 0")

    # --- transactions: idempotency ------------------------------------------
    op.create_index("uq_transactions_reference", "transactions", ["reference"], unique=True)

    # --- dedicated_accounts --------------------------------------------------
    op.create_table(
        "dedicated_accounts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("paystack_customer_code", sa.String(), nullable=False),
        sa.Column("paystack_dedicated_account_id", sa.String(), nullable=True),
        sa.Column("account_number", sa.String(), nullable=True),
        sa.Column("account_name", sa.String(), nullable=True),
        sa.Column("bank_name", sa.String(), nullable=True),
        sa.Column("bank_slug", sa.String(), nullable=True),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACTIVE", "FAILED", "INACTIVE", name="dvstatus"),
            nullable=False,
        ),
        sa.Column("last_requeried_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dedicated_accounts_user_id", "dedicated_accounts", ["user_id"], unique=False)
    op.create_index("ix_dedicated_accounts_account_number", "dedicated_accounts", ["account_number"], unique=True)

    # --- payments ------------------------------------------------------------
    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column(
            "provider",
            sa.Enum("PAYSTACK", "MOCK", name="paymentprovider"),
            nullable=False,
        ),
        sa.Column("provider_reference", sa.String(), nullable=True),
        sa.Column("internal_reference", sa.String(), nullable=False),
        sa.Column("payment_method", sa.String(), nullable=False),
        sa.Column(
            "purpose",
            sa.Enum("WALLET_FUNDING", "CONTRIBUTION_FUNDING", name="paymentpurpose"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("PENDING", "SUCCESSFUL", "FAILED", "REVERSED", name="paymentstatus"),
            nullable=False,
        ),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("internal_reference", name="uq_payments_internal_reference"),
        sa.UniqueConstraint("provider_reference", name="uq_payments_provider_reference"),
    )

    # --- webhook_events ------------------------------------------------------
    op.create_table(
        "webhook_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("RECEIVED", "PROCESSED", "FAILED", name="webhookeventstatus"),
            nullable=False,
        ),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", name="uq_webhook_events_event_id"),
    )
    op.create_index("ix_webhook_events_reference", "webhook_events", ["reference"], unique=False)

    # --- withdrawals: Paystack transfer tracking ----------------------------
    op.add_column("withdrawals", sa.Column("bank_account_id", sa.UUID(), nullable=True))
    op.add_column("withdrawals", sa.Column("paystack_recipient_code", sa.String(), nullable=True))
    op.add_column("withdrawals", sa.Column("paystack_transfer_code", sa.String(), nullable=True))
    op.add_column("withdrawals", sa.Column("paystack_reference", sa.String(), nullable=True))
    op.add_column("withdrawals", sa.Column("admin_id", sa.UUID(), nullable=True))
    op.add_column("withdrawals", sa.Column("approved_at", sa.DateTime(), nullable=True))
    op.add_column("withdrawals", sa.Column("completed_at", sa.DateTime(), nullable=True))
    op.add_column("withdrawals", sa.Column("rejected_at", sa.DateTime(), nullable=True))
    op.add_column("withdrawals", sa.Column("failure_reason", sa.Text(), nullable=True))

    op.create_index("uq_withdrawals_paystack_transfer_code", "withdrawals", ["paystack_transfer_code"], unique=True)
    op.create_index("ix_withdrawals_paystack_reference", "withdrawals", ["paystack_reference"], unique=False)
    op.create_foreign_key(
        "fk_withdrawals_bank_account_id",
        "withdrawals",
        "user_bank_accounts",
        ["bank_account_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_withdrawals_bank_account_id", "withdrawals", type_="foreignkey")
    op.drop_index("ix_withdrawals_paystack_reference", table_name="withdrawals")
    op.drop_index("uq_withdrawals_paystack_transfer_code", table_name="withdrawals")
    op.drop_column("withdrawals", "failure_reason")
    op.drop_column("withdrawals", "rejected_at")
    op.drop_column("withdrawals", "completed_at")
    op.drop_column("withdrawals", "approved_at")
    op.drop_column("withdrawals", "admin_id")
    op.drop_column("withdrawals", "paystack_reference")
    op.drop_column("withdrawals", "paystack_transfer_code")
    op.drop_column("withdrawals", "paystack_recipient_code")
    op.drop_column("withdrawals", "bank_account_id")

    op.drop_index("ix_webhook_events_reference", table_name="webhook_events")
    op.drop_table("webhook_events")
    op.execute("DROP TYPE IF EXISTS webhookeventstatus")

    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentpurpose")
    op.execute("DROP TYPE IF EXISTS paymentprovider")

    op.drop_index("ix_dedicated_accounts_account_number", table_name="dedicated_accounts")
    op.drop_index("ix_dedicated_accounts_user_id", table_name="dedicated_accounts")
    op.drop_table("dedicated_accounts")
    op.execute("DROP TYPE IF EXISTS dvstatus")

    op.drop_index("uq_transactions_reference", table_name="transactions")
    op.drop_constraint("ck_savings_reserved_nonneg", "savings_accounts", type_="check")
    op.drop_constraint("ck_savings_balance_nonneg", "savings_accounts", type_="check")
    op.drop_column("savings_accounts", "reserved")

    op.drop_index("ix_users_paystack_customer_code", table_name="users")
    op.drop_column("users", "paystack_customer_id")
    op.drop_column("users", "paystack_customer_code")

    op.execute("ALTER TYPE withdrawalstatus DROP VALUE IF EXISTS 'REVERSED'")
    op.execute("ALTER TYPE withdrawalstatus DROP VALUE IF EXISTS 'FAILED'")
    op.execute("ALTER TYPE withdrawalstatus DROP VALUE IF EXISTS 'PROCESSING'")
