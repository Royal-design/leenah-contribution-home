"""add roles to users

Revision ID: a1b2c3d4e5f6
Revises: f71770adff1d
Create Date: 2026-08-13 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "f71770adff1d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "roles",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[\"user\"]'::jsonb"),
        ),
    )
    op.execute(
        sa.text(
            "UPDATE users SET roles = '[\"user\", \"admin\"]'::jsonb "
            "WHERE role = 'ADMIN'"
        )
    )


def downgrade() -> None:
    op.drop_column("users", "roles")
