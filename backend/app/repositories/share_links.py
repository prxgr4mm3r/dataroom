from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ShareLink


class ShareLinkRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, link: ShareLink) -> ShareLink:
        self.db.add(link)
        self.db.flush()
        return link

    def get_by_id_for_owner(self, owner_user_id: str, share_id: str) -> ShareLink | None:
        return (
            self.db.query(ShareLink)
            .filter(
                ShareLink.id == share_id,
                ShareLink.owner_user_id == owner_user_id,
            )
            .one_or_none()
        )

    def get_by_kid(self, token_kid: str) -> ShareLink | None:
        return self.db.query(ShareLink).filter(ShareLink.token_kid == token_kid).one_or_none()

    def list_for_owner(
        self,
        owner_user_id: str,
        root_item_id: str | None = None,
        include_revoked: bool = False,
    ) -> list[ShareLink]:
        query = self.db.query(ShareLink).filter(ShareLink.owner_user_id == owner_user_id)
        if root_item_id:
            query = query.filter(ShareLink.root_item_id == root_item_id)
        if not include_revoked:
            query = query.filter(ShareLink.revoked_at.is_(None))
        query = query.order_by(ShareLink.created_at.desc())
        return query.all()
