from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FileAsset(Base):
    __tablename__ = "file_assets"

    item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("dataroom_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin: Mapped[str] = mapped_column(String(32), nullable=False)
    google_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)

    item = relationship("DataRoomItem", back_populates="file_asset")

    __table_args__ = (
        CheckConstraint(
            "origin in ('google_drive','local_upload','copied')",
            name="ck_file_assets_origin",
        ),
    )
