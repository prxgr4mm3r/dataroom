"""Allow share links to target Data Room root scope.

Revision ID: 20260308_0006
Revises: 20260307_0005
Create Date: 2026-03-08 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260308_0006"
down_revision = "20260307_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("share_links") as batch_op:
        batch_op.alter_column(
            "root_item_id",
            existing_type=sa.String(length=36),
            nullable=True,
        )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM share_links WHERE root_item_id IS NULL"))
    with op.batch_alter_table("share_links") as batch_op:
        batch_op.alter_column(
            "root_item_id",
            existing_type=sa.String(length=36),
            nullable=False,
        )
