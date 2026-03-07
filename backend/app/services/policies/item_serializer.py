from __future__ import annotations

from app.models import DataRoomItem, FileAsset, ItemKind


class ItemSerializer:
    def as_resource(
        self,
        item: DataRoomItem,
        asset: FileAsset | None = None,
        children_count: int | None = None,
    ) -> dict:
        size_bytes = item.size_bytes
        if size_bytes is None and asset and asset.size_bytes is not None:
            size_bytes = asset.size_bytes

        payload = {
            "id": item.id,
            "kind": item.kind,
            "name": item.name,
            "parent_id": item.parent_id,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat(),
            "children_count": int(children_count or 0),
            "size_bytes": int(size_bytes or 0),
        }
        if item.kind == ItemKind.FILE.value:
            payload.update(
                {
                    "mime_type": asset.mime_type if asset else None,
                    "imported_at": asset.imported_at.isoformat() if asset and asset.imported_at else None,
                    "origin": asset.origin if asset else None,
                    "google_file_id": asset.google_file_id if asset else None,
                }
            )
        return payload
