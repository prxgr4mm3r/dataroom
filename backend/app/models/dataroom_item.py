from __future__ import annotations

from enum import Enum

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


class ItemKind(str, Enum):
    FOLDER = "folder"
    FILE = "file"


class ItemStatus(str, Enum):
    ACTIVE = "active"
    FAILED = "failed"
    DELETED = "deleted"


class DataRoomItem(Base, IdMixin, TimestampMixin):
    __tablename__ = "dataroom_items"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    parent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("dataroom_items.id", ondelete="CASCADE"),
        nullable=True,
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=ItemStatus.ACTIVE.value)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user = relationship("User", back_populates="items")
    parent = relationship("DataRoomItem", remote_side="DataRoomItem.id")
    file_asset = relationship("FileAsset", back_populates="item", uselist=False)

    __table_args__ = (
        CheckConstraint("kind in ('folder','file')", name="ck_dataroom_items_kind"),
        CheckConstraint("status in ('active','failed','deleted')", name="ck_dataroom_items_status"),
        Index("idx_items_user_parent", "user_id", "parent_id"),
        Index("idx_items_user_kind_parent", "user_id", "kind", "parent_id"),
        Index(
            "uq_items_user_parent_name_active",
            "user_id",
            text("coalesce(parent_id, '__root__')"),
            "normalized_name",
            unique=True,
            sqlite_where=text("status != 'deleted'"),
            postgresql_where=text("status != 'deleted'"),
        ),
    )
