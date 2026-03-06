from __future__ import annotations

from app.errors import ApiError
from app.services.file_storage_service import FileStorageService
from app.services.item_service import ItemService


class BulkService:
    def __init__(self, item_service: ItemService):
        self.item_service = item_service

    @staticmethod
    def _sanitize_ids(item_ids: list[str]) -> list[str]:
        normalized = []
        for item_id in item_ids:
            value = str(item_id).strip()
            if not value:
                continue
            normalized.append(value)
        unique_ids = list(dict.fromkeys(normalized))
        if not unique_ids:
            raise ApiError(400, "invalid_request", "item_ids must contain at least one id.")
        return unique_ids

    def bulk_move(self, user_id: str, item_ids: list[str], target_folder_id: str | None) -> dict:
        ids = self._sanitize_ids(item_ids)
        resources = [self.item_service.move_item(user_id, item_id, target_folder_id) for item_id in ids]
        return {"items": resources}

    def bulk_copy(self, user_id: str, item_ids: list[str], target_folder_id: str | None) -> dict:
        ids = self._sanitize_ids(item_ids)
        created_paths: list[str] = []
        try:
            resources = [
                self.item_service.copy_item(
                    user_id,
                    item_id,
                    target_folder_id,
                    created_paths_sink=created_paths,
                )
                for item_id in ids
            ]
            return {"items": resources}
        except Exception:  # noqa: BLE001
            for path in created_paths:
                FileStorageService.delete_file(path)
            raise

    def bulk_delete(self, user_id: str, item_ids: list[str]) -> dict:
        ids = self._sanitize_ids(item_ids)
        for item_id in ids:
            if self.item_service.items.get_for_user(user_id, item_id) is None:
                raise ApiError(404, "item_not_found", "Item not found.")
        resources = [self.item_service.delete_item(user_id, item_id) for item_id in ids]
        return {"items": resources}
