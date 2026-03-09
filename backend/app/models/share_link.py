from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, IdMixin, TimestampMixin


class SharePermission:
    READ = "read"


class ShareLink(Base, IdMixin, TimestampMixin):
    __tablename__ = "share_links"

    owner_user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    root_item_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("dataroom_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    permission: Mapped[str] = mapped_column(String(16), nullable=False, default=SharePermission.READ)
    token_kid: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    token_secret_encrypted: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_access_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner = relationship("User")
    root_item = relationship("DataRoomItem")

    __table_args__ = (
        CheckConstraint("permission in ('read')", name="ck_share_links_permission"),
        Index(
            "ix_share_links_active_owner",
            "owner_user_id",
            "created_at",
            sqlite_where=text("revoked_at is null"),
            postgresql_where=text("revoked_at is null"),
        ),
    )
