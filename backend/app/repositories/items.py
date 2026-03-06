from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import DataRoomItem, ItemKind, ItemStatus


class ItemRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, item: DataRoomItem) -> DataRoomItem:
        self.db.add(item)
        self.db.flush()
        return item

    def get_for_user(self, user_id: str, item_id: str, include_deleted: bool = False) -> DataRoomItem | None:
        query = self.db.query(DataRoomItem).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.id == item_id,
        )
        if not include_deleted:
            query = query.filter(DataRoomItem.status != ItemStatus.DELETED.value)
        return query.one_or_none()

    def list_for_user_ids(
        self,
        user_id: str,
        item_ids: list[str],
        include_deleted: bool = False,
    ) -> list[DataRoomItem]:
        if not item_ids:
            return []
        query = self.db.query(DataRoomItem).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.id.in_(item_ids),
        )
        if not include_deleted:
            query = query.filter(DataRoomItem.status != ItemStatus.DELETED.value)
        return query.all()

    def list_children(self, user_id: str, parent_id: str | None) -> list[DataRoomItem]:
        query = self.db.query(DataRoomItem).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.status != ItemStatus.DELETED.value,
        )
        if parent_id is None:
            query = query.filter(DataRoomItem.parent_id.is_(None))
        else:
            query = query.filter(DataRoomItem.parent_id == parent_id)
        return query.all()

    def list_all_folders(self, user_id: str) -> list[DataRoomItem]:
        return (
            self.db.query(DataRoomItem)
            .filter(
                DataRoomItem.user_id == user_id,
                DataRoomItem.kind == ItemKind.FOLDER.value,
                DataRoomItem.status != ItemStatus.DELETED.value,
            )
            .all()
        )

    def list_active_names_in_parent(
        self,
        user_id: str,
        parent_id: str | None,
        exclude_item_id: str | None = None,
    ) -> list[str]:
        query = self.db.query(DataRoomItem.normalized_name).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.status != ItemStatus.DELETED.value,
        )
        if parent_id is None:
            query = query.filter(DataRoomItem.parent_id.is_(None))
        else:
            query = query.filter(DataRoomItem.parent_id == parent_id)
        if exclude_item_id:
            query = query.filter(DataRoomItem.id != exclude_item_id)
        return [row[0] for row in query.all()]
