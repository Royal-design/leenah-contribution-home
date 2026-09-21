"""add savings plan platform

Revision ID: 91f2a4b7c8d9
Revises: 7f3d9c2a1b5e
Create Date: 2026-09-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '91f2a4b7c8d9'
down_revision = '7f3d9c2a1b5e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New enum types must exist before the columns that reference them.
    savingsplanstatus = postgresql.ENUM(
        'ACTIVE', 'UPCOMING', 'COMPLETED', 'PAUSED', 'DRAFT',
        name='savingsplanstatus',
    )
    savingsplanstatus.create(op.get_bind(), checkfirst=True)
    enrollmentstatus = postgresql.ENUM('ACTIVE', 'LEFT', name='enrollmentstatus')
    enrollmentstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'savings_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('organization', sa.String(), nullable=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('target_amount', sa.Integer(), nullable=True),
        sa.Column('frequency', postgresql.ENUM(name='frequency', create_type=False), nullable=False),
        sa.Column('duration_months', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('next_payment_date', sa.DateTime(), nullable=True),
        sa.Column('last_payment_date', sa.DateTime(), nullable=True),
        sa.Column('rounds', sa.Integer(), nullable=False),
        sa.Column('total_saved', sa.Integer(), nullable=False),
        sa.Column('total_expected', sa.Integer(), nullable=False),
        sa.Column('progress', sa.Integer(), nullable=False),
        sa.Column('status', postgresql.ENUM(name='savingsplanstatus', create_type=False), nullable=False),
        sa.Column('is_open', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'savings_plan_enrollments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('total_saved', sa.Integer(), nullable=False),
        sa.Column('next_payment_date', sa.DateTime(), nullable=True),
        sa.Column('status', postgresql.ENUM(name='enrollmentstatus', create_type=False), nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['plan_id'], ['savings_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'user_id', name='uq_savings_plan_user'),
    )

    op.create_table(
        'savings_plan_schedules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=False),
        sa.Column('enrollment_id', sa.UUID(), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=False),
        sa.Column('status', postgresql.ENUM(name='schedulestatus', create_type=False), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('transaction_id', sa.UUID(), nullable=True),
        sa.Column('attempt_count', sa.Integer(), nullable=False),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['enrollment_id'], ['savings_plan_enrollments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_id'], ['savings_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_savings_plan_schedules_enrollment_id'),
        'savings_plan_schedules',
        ['enrollment_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_savings_plan_schedules_enrollment_id'), table_name='savings_plan_schedules')
    op.drop_table('savings_plan_schedules')
    op.drop_table('savings_plan_enrollments')
    op.drop_table('savings_plans')
    op.execute('DROP TYPE IF EXISTS enrollmentstatus')
    op.execute('DROP TYPE IF EXISTS savingsplanstatus')