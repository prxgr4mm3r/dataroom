from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models import DataRoomItem, ItemKind


class SortPolicy:
    ALLOWED_SORT_BY = {"name", "type", "size", "imported_at"}
    ALLOWED_SORT_ORDER = {"asc", "desc"}

    def sort_rows(
        self,
        rows: list[dict[str, Any]],
        sort_by: str,
        sort_order: str,
    ) -> list[dict[str, Any]]:
        normalized_sort = sort_by if sort_by in self.ALLOWED_SORT_BY else "name"
        normalized_order = sort_order if sort_order in self.ALLOWED_SORT_ORDER else "asc"
        reverse = normalized_order == "desc"

        folders = [r for r in rows if r["item"].kind == ItemKind.FOLDER.value]
        files = [r for r in rows if r["item"].kind == ItemKind.FILE.value]

        folders = sorted(folders, key=lambda row: self._folder_key(row, normalized_sort), reverse=reverse)
        files = sorted(files, key=lambda row: self._file_key(row, normalized_sort), reverse=reverse)
        return folders + files

    @staticmethod
    def _folder_key(row: dict[str, Any], sort_by: str) -> tuple:
        item: DataRoomItem = row["item"]
        if sort_by == "name":
            return (item.name.casefold(), item.created_at)
        return (item.name.casefold(), item.created_at)

    @staticmethod
    def _file_key(row: dict[str, Any], sort_by: str) -> tuple:
        item: DataRoomItem = row["item"]
        asset = row.get("asset")
        if sort_by == "name":
            return (item.name.casefold(), item.created_at)
        if sort_by == "type":
            mime_type = (asset.mime_type if asset else "") or ""
            return (mime_type.casefold(), item.name.casefold(), item.created_at)
        if sort_by == "size":
            size = asset.size_bytes if asset and asset.size_bytes is not None else -1
            return (size, item.name.casefold(), item.created_at)
        imported_at = asset.imported_at if asset else None
        if imported_at is None:
            imported_at = datetime.fromtimestamp(0, tz=timezone.utc)
        if imported_at.tzinfo is None:
            imported_at = imported_at.replace(tzinfo=timezone.utc)
        return (imported_at, item.name.casefold(), item.created_at)
