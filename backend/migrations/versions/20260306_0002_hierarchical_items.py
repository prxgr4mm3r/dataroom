"""Switch from flat files to hierarchical items/assets.

Revision ID: 20260306_0002
Revises: 20260306_0001
Create Date: 2026-03-06 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260306_0002"
down_revision = "20260306_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dataroom_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("parent_id", sa.String(length=36), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("normalized_name", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind in ('folder','file')", name="ck_dataroom_items_kind"),
        sa.CheckConstraint("status in ('active','failed','deleted')", name="ck_dataroom_items_status"),
        sa.ForeignKeyConstraint(["parent_id"], ["dataroom_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_items_user_parent", "dataroom_items", ["user_id", "parent_id"], unique=False)
    op.create_index(
        "idx_items_user_kind_parent",
        "dataroom_items",
        ["user_id", "kind", "parent_id"],
        unique=False,
    )
    op.create_index(
        "uq_items_user_parent_name_active",
        "dataroom_items",
        ["user_id", "parent_id", "normalized_name"],
        unique=True,
        sqlite_where=sa.text("status != 'deleted'"),
        postgresql_where=sa.text("status != 'deleted'"),
    )

    op.create_table(
        "file_assets",
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("origin", sa.String(length=32), nullable=False),
        sa.Column("google_file_id", sa.String(length=255), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("checksum", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "origin in ('google_drive','local_upload','copied')",
            name="ck_file_assets_origin",
        ),
        sa.ForeignKeyConstraint(["item_id"], ["dataroom_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("item_id"),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO dataroom_items (id, user_id, parent_id, kind, name, normalized_name, status, created_at, updated_at)
            SELECT
                id,
                user_id,
                NULL as parent_id,
                'file' as kind,
                name,
                lower(trim(name)) as normalized_name,
                CASE
                    WHEN status = 'deleted' THEN 'deleted'
                    WHEN status = 'failed' THEN 'failed'
                    ELSE 'active'
                END as status,
                created_at,
                updated_at
            FROM files
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO file_assets (item_id, mime_type, size_bytes, storage_path, origin, google_file_id, imported_at, checksum)
            SELECT
                id as item_id,
                mime_type,
                size_bytes,
                local_path as storage_path,
                CASE
                    WHEN source = 'google_drive' THEN 'google_drive'
                    ELSE 'local_upload'
                END as origin,
                google_file_id,
                imported_at,
                checksum_sha256 as checksum
            FROM files
            """
        )
    )

    op.drop_index("ix_files_user_id", table_name="files")
    op.drop_table("files")


def downgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("google_connection_id", sa.String(length=36), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("google_file_id", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("local_path", sa.Text(), nullable=True),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status in ('ready','failed','deleted')", name="ck_files_status"),
        sa.ForeignKeyConstraint(["google_connection_id"], ["google_drive_connections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "google_file_id", name="uq_files_user_google_file_id"),
    )
    op.create_index("ix_files_user_id", "files", ["user_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO files (
                id, user_id, google_connection_id, source, google_file_id, name, mime_type, size_bytes, local_path,
                checksum_sha256, status, imported_at, created_at, updated_at
            )
            SELECT
                i.id,
                i.user_id,
                NULL as google_connection_id,
                CASE
                    WHEN a.origin = 'google_drive' THEN 'google_drive'
                    ELSE 'google_drive'
                END as source,
                COALESCE(a.google_file_id, i.id) as google_file_id,
                i.name,
                a.mime_type,
                a.size_bytes,
                a.storage_path,
                a.checksum,
                CASE
                    WHEN i.status = 'deleted' THEN 'deleted'
                    WHEN i.status = 'failed' THEN 'failed'
                    ELSE 'ready'
                END as status,
                a.imported_at,
                i.created_at,
                i.updated_at
            FROM dataroom_items i
            LEFT JOIN file_assets a ON a.item_id = i.id
            WHERE i.kind = 'file'
            """
        )
    )

    op.drop_table("file_assets")
    op.drop_index("uq_items_user_parent_name_active", table_name="dataroom_items")
    op.drop_index("idx_items_user_kind_parent", table_name="dataroom_items")
    op.drop_index("idx_items_user_parent", table_name="dataroom_items")
    op.drop_table("dataroom_items")
