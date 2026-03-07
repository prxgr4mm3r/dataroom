"""Store encrypted share token secret for link listing/copy.

Revision ID: 20260307_0005
Revises: 20260307_0004
Create Date: 2026-03-07 20:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0005"
down_revision = "20260307_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "share_links",
        sa.Column("token_secret_encrypted", sa.String(length=1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("share_links", "token_secret_encrypted")
