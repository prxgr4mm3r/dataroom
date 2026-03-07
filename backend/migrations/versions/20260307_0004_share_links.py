"""Add share links for read-only public access.

Revision ID: 20260307_0004
Revises: 20260307_0003
Create Date: 2026-03-07 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0004"
down_revision = "20260307_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "share_links",
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("root_item_id", sa.String(length=36), nullable=False),
        sa.Column("permission", sa.String(length=16), nullable=False),
        sa.Column("token_kid", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_access_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("permission in ('read')", name="ck_share_links_permission"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["root_item_id"], ["dataroom_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_kid"),
    )
    op.create_index(op.f("ix_share_links_owner_user_id"), "share_links", ["owner_user_id"], unique=False)
    op.create_index(op.f("ix_share_links_root_item_id"), "share_links", ["root_item_id"], unique=False)

    op.create_index(
        "ix_share_links_active_owner",
        "share_links",
        ["owner_user_id", "created_at"],
        unique=False,
        sqlite_where=sa.text("revoked_at is null"),
        postgresql_where=sa.text("revoked_at is null"),
    )


def downgrade() -> None:
    op.drop_index("ix_share_links_active_owner", table_name="share_links")
    op.drop_index(op.f("ix_share_links_root_item_id"), table_name="share_links")
    op.drop_index(op.f("ix_share_links_owner_user_id"), table_name="share_links")
    op.drop_table("share_links")
