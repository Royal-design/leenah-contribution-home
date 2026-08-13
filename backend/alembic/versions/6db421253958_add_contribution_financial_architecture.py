"""add contribution financial architecture

Revision ID: 6db421253958
Revises: a1b2c3d4e5f6
Create Date: 2026-08-13 10:25:34.073829

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '6db421253958'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enum types must exist before columns that reference them.
    # (payoutstatus is created by the contribution_payouts create_table below.)
    memberstatus = postgresql.ENUM('ACTIVE', 'LEFT', 'REMOVED', name='memberstatus')
    memberstatus.create(op.get_bind(), checkfirst=True)
    fundingmethod = postgresql.ENUM('WALLET', 'CARD', 'BANK_TRANSFER', name='fundingmethod')
    fundingmethod.create(op.get_bind(), checkfirst=True)

    op.create_table('user_bank_accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('bank_code', sa.String(), nullable=True),
        sa.Column('bank_name', sa.String(), nullable=False),
        sa.Column('account_number', sa.String(), nullable=False),
        sa.Column('account_name', sa.String(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('provider_recipient_code', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('contribution_payouts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('contribution_id', sa.UUID(), nullable=False),
        sa.Column('member_id', sa.UUID(), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=False),
        sa.Column('scheduled_date', sa.DateTime(), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'PAID', 'SKIPPED', name='payoutstatus'), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('transaction_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['contribution_id'], ['contributions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['member_id'], ['contribution_members.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # --- contribution_members ---
    op.add_column('contribution_members', sa.Column('payout_position', sa.Integer(), nullable=True))
    op.add_column(
        'contribution_members',
        sa.Column('status', sa.Enum('ACTIVE', 'LEFT', 'REMOVED', name='memberstatus'), nullable=False, server_default='ACTIVE'),
    )
    op.add_column(
        'contribution_members',
        sa.Column('funding_method', sa.Enum('WALLET', 'CARD', 'BANK_TRANSFER', name='fundingmethod'), nullable=False, server_default='WALLET'),
    )
    op.add_column('contribution_members', sa.Column('automatic', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('contribution_members', sa.Column('next_payment_date', sa.DateTime(), nullable=True))

    # --- contribution_schedules ---
    op.add_column('contribution_schedules', sa.Column('member_id', sa.UUID(), nullable=True))
    op.add_column('contribution_schedules', sa.Column('paid_at', sa.DateTime(), nullable=True))
    op.add_column('contribution_schedules', sa.Column('transaction_id', sa.UUID(), nullable=True))
    op.add_column('contribution_schedules', sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('contribution_schedules', sa.Column('failure_reason', sa.String(), nullable=True))

    op.create_index(op.f('ix_contribution_schedules_member_id'), 'contribution_schedules', ['member_id'], unique=False)
    op.create_foreign_key('fk_contribution_schedules_transaction_id', 'contribution_schedules', 'transactions', ['transaction_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_contribution_schedules_member_id', 'contribution_schedules', 'contribution_members', ['member_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    op.drop_constraint('fk_contribution_schedules_member_id', 'contribution_schedules', type_='foreignkey')
    op.drop_constraint('fk_contribution_schedules_transaction_id', 'contribution_schedules', type_='foreignkey')
    op.drop_index(op.f('ix_contribution_schedules_member_id'), table_name='contribution_schedules')
    op.drop_column('contribution_schedules', 'failure_reason')
    op.drop_column('contribution_schedules', 'attempt_count')
    op.drop_column('contribution_schedules', 'transaction_id')
    op.drop_column('contribution_schedules', 'paid_at')
    op.drop_column('contribution_schedules', 'member_id')
    op.drop_column('contribution_members', 'next_payment_date')
    op.drop_column('contribution_members', 'automatic')
    op.drop_column('contribution_members', 'funding_method')
    op.drop_column('contribution_members', 'status')
    op.drop_column('contribution_members', 'payout_position')
    op.drop_table('contribution_payouts')
    op.drop_table('user_bank_accounts')
    op.execute('DROP TYPE IF EXISTS payoutstatus')
    op.execute('DROP TYPE IF EXISTS memberstatus')
    op.execute('DROP TYPE IF EXISTS fundingmethod')
