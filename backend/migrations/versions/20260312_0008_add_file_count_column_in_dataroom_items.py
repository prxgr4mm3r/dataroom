"""add file count column in dataroom items

Revision ID: 20260312_0008
Revises: 20260311_0007
Create Date: 2026-03-11 13:09:03.948610
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260312_0008'
down_revision = '20260311_0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dataroom_items",
        sa.Column("file_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("dataroom_items", "file_count")
