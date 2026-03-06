from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.item_service import ItemService


class FolderService:
    def __init__(self, item_service: ItemService):
        self.item_service = item_service

    @classmethod
    def from_dependencies(
        cls,
        db: Session,
        config: dict[str, Any],
        drive_service,
        storage_service,
    ) -> "FolderService":
        return cls(ItemService(db, config, drive_service, storage_service))

    def get_tree(self, user_id: str) -> dict:
        return self.item_service.get_folder_tree(user_id)

    def create(self, user_id: str, parent_id: str | None, name: str) -> dict:
        return self.item_service.create_folder(user_id, parent_id, name)
