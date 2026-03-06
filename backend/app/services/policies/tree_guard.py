from __future__ import annotations

from app.errors import ApiError
from app.models import DataRoomItem, ItemKind
from app.repositories import ItemRepository


class TreeGuard:
    @staticmethod
    def ensure_folder(item: DataRoomItem, error_code: str = "target_not_folder") -> None:
        if item.kind != ItemKind.FOLDER.value:
            raise ApiError(400, error_code, "Target item must be a folder.")

    def ensure_move_has_no_cycle(
        self,
        user_id: str,
        moving_item: DataRoomItem,
        target_folder: DataRoomItem,
        items: ItemRepository,
    ) -> None:
        if moving_item.kind != ItemKind.FOLDER.value:
            return
        if moving_item.id == target_folder.id:
            raise ApiError(409, "invalid_move_cycle", "Cannot move folder into itself.")

        cursor = target_folder
        while cursor.parent_id is not None:
            parent = items.get_for_user(user_id, cursor.parent_id, include_deleted=False)
            if parent is None:
                break
            if parent.id == moving_item.id:
                raise ApiError(409, "invalid_move_cycle", "Cannot move folder into descendant.")
            cursor = parent
