from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import FileAsset


class FileAssetRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, asset: FileAsset) -> FileAsset:
        self.db.add(asset)
        self.db.flush()
        return asset

    def get_for_item(self, item_id: str) -> FileAsset | None:
        return self.db.query(FileAsset).filter(FileAsset.item_id == item_id).one_or_none()

    def list_for_items(self, item_ids: list[str]) -> list[FileAsset]:
        if not item_ids:
            return []
        return self.db.query(FileAsset).filter(FileAsset.item_id.in_(item_ids)).all()
