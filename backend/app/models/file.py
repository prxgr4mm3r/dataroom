from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


class FileStatus(str, Enum):
    READY = "ready"
    FAILED = "failed"
    DELETED = "deleted"


class DataFile(Base, IdMixin, TimestampMixin):
    __tablename__ = "files"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    google_connection_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("google_drive_connections.id", ondelete="SET NULL"),
        nullable=True,
    )
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="google_drive")
    google_file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    local_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=FileStatus.READY.value)
    imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="files")
    google_connection = relationship("GoogleDriveConnection", back_populates="files")

    __table_args__ = (
        UniqueConstraint("user_id", "google_file_id", name="uq_files_user_google_file_id"),
        CheckConstraint("status in ('ready','failed','deleted')", name="ck_files_status"),
    )
