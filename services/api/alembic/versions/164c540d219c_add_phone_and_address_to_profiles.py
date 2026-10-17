"""add phone and address to profiles

Revision ID: 164c540d219c
Revises: 5a547bc81b74
"""

from alembic import op
import sqlalchemy as sa

revision = "164c540d219c"
down_revision = "5a547bc81b74"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column("phone", sa.Text(), nullable=True),
        schema="public",
    )
    op.add_column(
        "profiles",
        sa.Column("address", sa.Text(), nullable=True),
        schema="public",
    )


def downgrade() -> None:
    op.drop_column("profiles", "address", schema="public")
    op.drop_column("profiles", "phone", schema="public")