from __future__ import annotations

from sqlalchemy import func, or_, text
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

    def list_active_for_user(self, user_id: str) -> list[DataRoomItem]:
        return (
            self.db.query(DataRoomItem)
            .filter(
                DataRoomItem.user_id == user_id,
                DataRoomItem.status != ItemStatus.DELETED.value,
            )
            .all()
        )

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

    def count_children(self, user_id: str, parent_id: str) -> int:
        return int(
            self.db.query(func.count(DataRoomItem.id))
            .filter(
                DataRoomItem.user_id == user_id,
                DataRoomItem.parent_id == parent_id,
                DataRoomItem.status != ItemStatus.DELETED.value,
            )
            .scalar()
            or 0
        )

    def count_children_by_parent_ids(self, user_id: str, parent_ids: list[str]) -> dict[str, int]:
        if not parent_ids:
            return {}

        rows = (
            self.db.query(
                DataRoomItem.parent_id,
                func.count(DataRoomItem.id),
            )
            .filter(
                DataRoomItem.user_id == user_id,
                DataRoomItem.parent_id.in_(parent_ids),
                DataRoomItem.status != ItemStatus.DELETED.value,
            )
            .group_by(DataRoomItem.parent_id)
            .all()
        )

        result = {parent_id: 0 for parent_id in parent_ids}
        for parent_id, count in rows:
            if parent_id is not None:
                result[parent_id] = int(count or 0)
        return result

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

    def search_active_for_user(
        self,
        user_id: str,
        normalized_terms: list[str],
        limit: int,
    ) -> list[DataRoomItem]:
        query = self.db.query(DataRoomItem).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.status != ItemStatus.DELETED.value,
        )

        for term in normalized_terms:
            query = query.filter(DataRoomItem.normalized_name.contains(term))

        return (
            query.order_by(DataRoomItem.updated_at.desc(), DataRoomItem.created_at.desc())
            .limit(limit)
            .all()
        )

    def search_active_for_user_in_ids(
        self,
        user_id: str,
        normalized_terms: list[str],
        limit: int,
        item_ids: list[str],
    ) -> list[DataRoomItem]:
        if not item_ids:
            return []

        query = self.db.query(DataRoomItem).filter(
            DataRoomItem.user_id == user_id,
            DataRoomItem.status != ItemStatus.DELETED.value,
        )

        # SQLite has a low bound-parameter limit, so split large IN lists into chunks.
        chunk_size = 900
        chunks = [item_ids[i : i + chunk_size] for i in range(0, len(item_ids), chunk_size)]
        if len(chunks) == 1:
            query = query.filter(DataRoomItem.id.in_(chunks[0]))
        else:
            query = query.filter(or_(*[DataRoomItem.id.in_(chunk) for chunk in chunks]))

        for term in normalized_terms:
            query = query.filter(DataRoomItem.normalized_name.contains(term))

        return (
            query.order_by(DataRoomItem.updated_at.desc(), DataRoomItem.created_at.desc())
            .limit(limit)
            .all()
        )

    def list_subtree_ids_for_user(self, user_id: str, root_item_id: str) -> list[str]:
        rows = self.db.execute(
            text(
                """
                WITH RECURSIVE subtree(id) AS (
                    SELECT i.id
                    FROM dataroom_items i
                    WHERE i.user_id = :user_id
                      AND i.id = :root_item_id
                      AND i.status != :deleted_status
                    UNION ALL
                    SELECT child.id
                    FROM dataroom_items child
                    JOIN subtree parent ON child.parent_id = parent.id
                    WHERE child.user_id = :user_id
                      AND child.status != :deleted_status
                )
                SELECT id
                FROM subtree
                """
            ),
            {
                "user_id": user_id,
                "root_item_id": root_item_id,
                "deleted_status": ItemStatus.DELETED.value,
            },
        ).all()
        return [str(row[0]) for row in rows if row and row[0]]

    def is_descendant_or_self(self, user_id: str, item_id: str, ancestor_id: str) -> bool:
        row = self.db.execute(
            text(
                """
                WITH RECURSIVE ancestors(id, parent_id) AS (
                    SELECT i.id, i.parent_id
                    FROM dataroom_items i
                    WHERE i.user_id = :user_id
                      AND i.id = :item_id
                      AND i.status != :deleted_status
                    UNION ALL
                    SELECT parent.id, parent.parent_id
                    FROM dataroom_items parent
                    JOIN ancestors child ON parent.id = child.parent_id
                    WHERE parent.user_id = :user_id
                      AND parent.status != :deleted_status
                )
                SELECT 1
                FROM ancestors
                WHERE id = :ancestor_id
                LIMIT 1
                """
            ),
            {
                "user_id": user_id,
                "item_id": item_id,
                "ancestor_id": ancestor_id,
                "deleted_status": ItemStatus.DELETED.value,
            },
        ).first()
        return row is not None
