"""financial commission and withdrawal architecture

Revision ID: c4d5e6f7a8b9
Revises: 91f2a4b7c8d9
Create Date: 2026-09-22 00:00:00.000000

Adds:
* platform_settings table (admin-configurable commission defaults)
* commission columns on savings_plans / contributions / contribution_payouts
* withdrawal channel/source/reason/commission + related plan columns
* commission breakdown + related entities on the transactions ledger
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = '91f2a4b7c8d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New enum types must exist before the columns that reference them.
    withdrawalchannel = postgresql.ENUM('WALLET', 'BANK', name='withdrawalchannel')
    withdrawalchannel.create(op.get_bind(), checkfirst=True)
    withdrawalsource = postgresql.ENUM(
        'WALLET', 'SAVINGS_PLAN', 'CONTRIBUTION', 'EMERGENCY', 'ADMIN',
        name='withdrawalsource',
    )
    withdrawalsource.create(op.get_bind(), checkfirst=True)

    # ------------------------------------------------------------ settings
    op.create_table(
        'platform_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('key', sa.String(), nullable=False),
        sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )
    op.create_index('ix_platform_settings_key', 'platform_settings', ['key'], unique=True)

    # ------------------------------------------------------ transactions
    op.add_column('transactions', sa.Column('currency', sa.String(), nullable=False, server_default='NGN'))
    op.add_column('transactions', sa.Column('source', sa.String(), nullable=True))
    op.add_column('transactions', sa.Column('gross_amount', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('commission_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('transactions', sa.Column('commission_type', sa.String(), nullable=True))
    op.add_column('transactions', sa.Column('commission_amount', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('fee_amount', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('net_amount', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('related_savings_plan_id', sa.UUID(), nullable=True))
    op.add_column('transactions', sa.Column('related_contribution_id', sa.UUID(), nullable=True))
    op.add_column('transactions', sa.Column('related_withdrawal_id', sa.UUID(), nullable=True))
    op.add_column('transactions', sa.Column('related_emergency_request_id', sa.UUID(), nullable=True))
    op.add_column('transactions', sa.Column('completed_at', sa.DateTime(), nullable=True))
    op.add_column('transactions', sa.Column('approved_by', sa.UUID(), nullable=True))
    op.add_column('transactions', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('transactions', sa.Column('failure_reason', sa.Text(), nullable=True))
    op.create_foreign_key('fk_transactions_savings_plan_id', 'transactions', 'savings_plans', ['related_savings_plan_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_transactions_contribution_id', 'transactions', 'contributions', ['related_contribution_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_transactions_withdrawal_id', 'transactions', 'withdrawals', ['related_withdrawal_id'], ['id'], ondelete='SET NULL')

    # ------------------------------------------------------- withdrawals
    op.add_column('withdrawals', sa.Column('channel', postgresql.ENUM(name='withdrawalchannel', create_type=False), nullable=False, server_default='BANK'))
    op.add_column('withdrawals', sa.Column('source', postgresql.ENUM(name='withdrawalsource', create_type=False), nullable=False, server_default='WALLET'))
    op.add_column('withdrawals', sa.Column('reason', sa.Text(), nullable=True))
    op.add_column('withdrawals', sa.Column('admin_note', sa.Text(), nullable=True))
    op.add_column('withdrawals', sa.Column('related_savings_plan_id', sa.UUID(), nullable=True))
    op.add_column('withdrawals', sa.Column('related_contribution_id', sa.UUID(), nullable=True))
    op.add_column('withdrawals', sa.Column('gross_amount', sa.Integer(), nullable=True))
    op.add_column('withdrawals', sa.Column('commission_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('withdrawals', sa.Column('commission_type', sa.String(), nullable=True))
    op.add_column('withdrawals', sa.Column('commission_amount', sa.Integer(), nullable=True))
    op.add_column('withdrawals', sa.Column('fee_amount', sa.Integer(), nullable=True))
    op.add_column('withdrawals', sa.Column('net_amount', sa.Integer(), nullable=True))
    op.alter_column('withdrawals', 'bank_name', existing_type=sa.String(), nullable=True)
    op.alter_column('withdrawals', 'account_number', existing_type=sa.String(), nullable=True)
    op.alter_column('withdrawals', 'account_name', existing_type=sa.String(), nullable=True)
    op.create_foreign_key('fk_withdrawals_savings_plan_id', 'withdrawals', 'savings_plans', ['related_savings_plan_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_withdrawals_contribution_id', 'withdrawals', 'contributions', ['related_contribution_id'], ['id'], ondelete='SET NULL')

    # ----------------------------------------------------- savings_plans
    op.add_column('savings_plans', sa.Column('commission_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('savings_plans', sa.Column('commission_type', sa.String(), nullable=True))
    op.add_column('savings_plans', sa.Column('commission_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('savings_plans', sa.Column('commission_fixed', sa.Integer(), nullable=True))

    # ------------------------------------------------------ contributions
    op.add_column('contributions', sa.Column('commission_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('contributions', sa.Column('commission_type', sa.String(), nullable=True))
    op.add_column('contributions', sa.Column('commission_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('contributions', sa.Column('commission_fixed', sa.Integer(), nullable=True))

    # ------------------------------------------------- contribution_payouts
    op.add_column('contribution_payouts', sa.Column('eligible_at', sa.DateTime(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('reviewed_by', sa.UUID(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('reviewed_at', sa.DateTime(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('admin_note', sa.Text(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('gross_amount', sa.Integer(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('commission_rate', sa.Numeric(8, 2), nullable=True))
    op.add_column('contribution_payouts', sa.Column('commission_type', sa.String(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('commission_amount', sa.Integer(), nullable=True))
    op.add_column('contribution_payouts', sa.Column('net_amount', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_constraint('fk_withdrawals_contribution_id', 'withdrawals', type_='foreignkey')
    op.drop_constraint('fk_withdrawals_savings_plan_id', 'withdrawals', type_='foreignkey')
    op.drop_column('withdrawals', 'net_amount')
    op.drop_column('withdrawals', 'fee_amount')
    op.drop_column('withdrawals', 'commission_amount')
    op.drop_column('withdrawals', 'commission_type')
    op.drop_column('withdrawals', 'commission_rate')
    op.drop_column('withdrawals', 'gross_amount')
    op.drop_column('withdrawals', 'related_contribution_id')
    op.drop_column('withdrawals', 'related_savings_plan_id')
    op.drop_column('withdrawals', 'admin_note')
    op.drop_column('withdrawals', 'reason')
    op.drop_column('withdrawals', 'source')
    op.drop_column('withdrawals', 'channel')

    op.drop_constraint('fk_transactions_withdrawal_id', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transactions_contribution_id', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transactions_savings_plan_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'failure_reason')
    op.drop_column('transactions', 'approved_at')
    op.drop_column('transactions', 'approved_by')
    op.drop_column('transactions', 'completed_at')
    op.drop_column('transactions', 'related_emergency_request_id')
    op.drop_column('transactions', 'related_withdrawal_id')
    op.drop_column('transactions', 'related_contribution_id')
    op.drop_column('transactions', 'related_savings_plan_id')
    op.drop_column('transactions', 'net_amount')
    op.drop_column('transactions', 'fee_amount')
    op.drop_column('transactions', 'commission_amount')
    op.drop_column('transactions', 'commission_type')
    op.drop_column('transactions', 'commission_rate')
    op.drop_column('transactions', 'gross_amount')
    op.drop_column('transactions', 'source')
    op.drop_column('transactions', 'currency')

    op.drop_column('contribution_payouts', 'net_amount')
    op.drop_column('contribution_payouts', 'commission_amount')
    op.drop_column('contribution_payouts', 'commission_type')
    op.drop_column('contribution_payouts', 'commission_rate')
    op.drop_column('contribution_payouts', 'gross_amount')
    op.drop_column('contribution_payouts', 'admin_note')
    op.drop_column('contribution_payouts', 'reviewed_at')
    op.drop_column('contribution_payouts', 'reviewed_by')
    op.drop_column('contribution_payouts', 'eligible_at')

    op.drop_column('contributions', 'commission_fixed')
    op.drop_column('contributions', 'commission_rate')
    op.drop_column('contributions', 'commission_type')
    op.drop_column('contributions', 'commission_enabled')

    op.drop_column('savings_plans', 'commission_fixed')
    op.drop_column('savings_plans', 'commission_rate')
    op.drop_column('savings_plans', 'commission_type')
    op.drop_column('savings_plans', 'commission_enabled')

    op.drop_index('ix_platform_settings_key', table_name='platform_settings')
    op.drop_table('platform_settings')

    postgresql.ENUM(name='withdrawalsource').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='withdrawalchannel').drop(op.get_bind(), checkfirst=True)