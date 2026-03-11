"""Enforce unique active item names in root folders.

Revision ID: 20260311_0007
Revises: 20260308_0006
Create Date: 2026-03-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0007"
down_revision = "20260308_0006"
branch_labels = None
depends_on = None


def _assert_no_root_duplicates() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT user_id, normalized_name, COUNT(*) AS cnt
            FROM dataroom_items
            WHERE parent_id IS NULL
              AND status != 'deleted'
            GROUP BY user_id, normalized_name
            HAVING COUNT(*) > 1
            LIMIT 10
            """
        )
    ).fetchall()

    if not rows:
        return

    sample = ", ".join(
        f"user_id={row[0]} normalized_name={row[1]} count={row[2]}"
        for row in rows
    )
    raise RuntimeError(
        "Cannot apply migration: found duplicate active item names in root. "
        f"Resolve duplicates first. Sample: {sample}"
    )


def upgrade() -> None:
    _assert_no_root_duplicates()

    op.drop_index("uq_items_user_parent_name_active", table_name="dataroom_items")
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX uq_items_user_parent_name_active
            ON dataroom_items (user_id, coalesce(parent_id, '__root__'), normalized_name)
            WHERE status != 'deleted'
            """
        )
    )


def downgrade() -> None:
    op.drop_index("uq_items_user_parent_name_active", table_name="dataroom_items")
    op.create_index(
        "uq_items_user_parent_name_active",
        "dataroom_items",
        ["user_id", "parent_id", "normalized_name"],
        unique=True,
        sqlite_where=sa.text("status != 'deleted'"),
        postgresql_where=sa.text("status != 'deleted'"),
    )
