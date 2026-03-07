"""Add cached item sizes for files and folders.

Revision ID: 20260307_0003
Revises: 20260306_0002
Create Date: 2026-03-07 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0003"
down_revision = "20260306_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dataroom_items",
        sa.Column("size_bytes", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.execute(sa.text("UPDATE dataroom_items SET size_bytes = 0"))

    op.execute(
        sa.text(
            """
            UPDATE dataroom_items
            SET size_bytes = COALESCE(
                (SELECT a.size_bytes FROM file_assets a WHERE a.item_id = dataroom_items.id),
                0
            )
            WHERE kind = 'file' AND status != 'deleted'
            """
        )
    )

    op.execute(
        sa.text(
            """
            WITH RECURSIVE folder_descendants(folder_id, item_id) AS (
                SELECT id, id
                FROM dataroom_items
                WHERE kind = 'folder' AND status != 'deleted'

                UNION ALL

                SELECT fd.folder_id, child.id
                FROM folder_descendants fd
                JOIN dataroom_items child ON child.parent_id = fd.item_id
                WHERE child.status != 'deleted'
            ),
            folder_totals AS (
                SELECT
                    fd.folder_id,
                    COALESCE(SUM(COALESCE(a.size_bytes, 0)), 0) AS total_size
                FROM folder_descendants fd
                JOIN dataroom_items i ON i.id = fd.item_id
                LEFT JOIN file_assets a ON a.item_id = i.id
                WHERE i.kind = 'file' AND i.status != 'deleted'
                GROUP BY fd.folder_id
            )
            UPDATE dataroom_items
            SET size_bytes = COALESCE(
                (SELECT total_size FROM folder_totals WHERE folder_totals.folder_id = dataroom_items.id),
                0
            )
            WHERE kind = 'folder'
            """
        )
    )


def downgrade() -> None:
    op.drop_column("dataroom_items", "size_bytes")
