
"""baseline existing schema

Revision ID: 43962ac20559
Revises:
Create Date: (keep the generated date)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# Alembic revision identifiers
revision: str = "43962ac20559"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Baseline only: preserve existing database objects.
    pass


def downgrade() -> None:
    # Never drop existing database objects in this baseline.
    pass
