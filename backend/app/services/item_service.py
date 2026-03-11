from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session
from werkzeug.datastructures import FileStorage

from app.errors import ApiError
from app.models import DataRoomItem, FileAsset, ItemKind, ItemStatus, User
from app.repositories import FileAssetRepository, GoogleConnectionRepository, ItemRepository
from app.services.file_storage_service import FileStorageService
from app.services.google_drive_service import GoogleDriveService
from app.services.policies import ItemSerializer, NameConflictResolver, SortPolicy, TreeGuard


class ItemService:
    def __init__(
        self,
        db: Session,
        config: dict[str, Any],
        drive_service: GoogleDriveService,
        storage_service: FileStorageService,
    ):
        self.db = db
        self.config = config
        self.drive_service = drive_service
        self.storage_service = storage_service
        self.items = ItemRepository(db)
        self.assets = FileAssetRepository(db)
        self.connections = GoogleConnectionRepository(db)
        self.name_resolver = NameConflictResolver()
        self.tree_guard = TreeGuard()
        self.sort_policy = SortPolicy()
        self.serializer = ItemSerializer()

    def _children_count_for_item(self, user_id: str, item: DataRoomItem) -> int:
        if item.kind != ItemKind.FOLDER.value:
            return 0
        return self.items.count_children(user_id, item.id)

    @staticmethod
    def _normalize_size(value: int | None) -> int:
        if value is None:
            return 0
        return max(0, int(value))

    def _apply_size_delta_to_ancestors(self, user_id: str, parent_id: str | None, delta: int) -> None:
        if delta == 0:
            return

        cursor_parent_id = parent_id
        now = datetime.now(timezone.utc)
        while cursor_parent_id is not None:
            folder = self.items.get_for_user(user_id, cursor_parent_id)
            if folder is None or folder.kind != ItemKind.FOLDER.value:
                break
            folder.size_bytes = max(0, self._normalize_size(folder.size_bytes) + delta)
            print(f"Applying file count delta {delta} to folder {folder.id} (before: {folder.file_count})")
            folder.file_count = max(0, folder.file_count + (1 if delta > 0 else -1))
            print(f"New file count for folder {folder.id}: {folder.file_count}")
            folder.updated_at = now
            cursor_parent_id = folder.parent_id

    @staticmethod
    def _normalize_parent_id(parent_id: str | None) -> str | None:
        if parent_id in (None, "", "root", "null"):
            return None
        return parent_id

    def _resolve_parent_folder(self, user_id: str, folder_id: str | None) -> DataRoomItem | None:
        normalized = self._normalize_parent_id(folder_id)
        if normalized is None:
            return None
        folder = self.items.get_for_user(user_id, normalized)
        if folder is None:
            raise ApiError(404, "target_folder_not_found", "Target folder not found.")
        if folder.kind != ItemKind.FOLDER.value:
            raise ApiError(400, "target_not_folder", "Target item must be a folder.")
        return folder

    def _resolve_unique_name(
        self,
        user_id: str,
        parent_id: str | None,
        requested_name: str,
        exclude_item_id: str | None = None,
    ) -> tuple[str, str]:
        existing = set(self.items.list_active_names_in_parent(user_id, parent_id, exclude_item_id=exclude_item_id))
        try:
            resolved = self.name_resolver.resolve_unique(requested_name, existing)
        except (TypeError, ValueError) as exc:
            raise ApiError(400, "invalid_name", "Item name is invalid.") from exc
        return resolved, self.name_resolver.normalize(resolved)

    def _build_breadcrumbs(self, user_id: str, folder: DataRoomItem | None) -> list[dict]:
        if folder is None:
            return [{"id": "root", "name": "Data Room"}]

        chain: list[DataRoomItem] = []
        cursor = folder
        while True:
            chain.append(cursor)
            if cursor.parent_id is None:
                break
            parent = self.items.get_for_user(user_id, cursor.parent_id)
            if parent is None:
                break
            cursor = parent

        breadcrumbs = [{"id": "root", "name": "Data Room"}]
        for node in reversed(chain):
            breadcrumbs.append({"id": node.id, "name": node.name})
        return breadcrumbs

    def create_folder(self, user_id: str, parent_id: str | None, name: str) -> dict:
        parent = self._resolve_parent_folder(user_id, parent_id)
        normalized_parent_id = parent.id if parent else None
        resolved_name, normalized_name = self._resolve_unique_name(user_id, normalized_parent_id, name)
        folder = DataRoomItem(
            user_id=user_id,
            parent_id=normalized_parent_id,
            kind=ItemKind.FOLDER.value,
            name=resolved_name,
            normalized_name=normalized_name,
            status=ItemStatus.ACTIVE.value,
            size_bytes=0,
        )
        self.items.save(folder)
        return self.serializer.as_resource(folder, children_count=0)

    def get_folder_tree(self, user_id: str) -> dict:
        folders = self.items.list_all_folders(user_id)
        children_by_parent: dict[str | None, list[DataRoomItem]] = {}
        for folder in folders:
            children_by_parent.setdefault(folder.parent_id, []).append(folder)
        for children in children_by_parent.values():
            children.sort(key=lambda f: f.name.casefold())

        def build(parent_id: str | None) -> list[dict]:
            result = []
            for folder in children_by_parent.get(parent_id, []):
                result.append(
                    {
                        "id": folder.id,
                        "name": folder.name,
                        "children": build(folder.id),
                    }
                )
            return result

        return {
            "root": {
                "id": "root",
                "name": "Data Room",
                "children": build(None),
            }
        }

    def list_items(
        self,
        user_id: str,
        parent_id: str | None,
        sort_by: str,
        sort_order: str,
    ) -> dict:
        folder = self._resolve_parent_folder(user_id, parent_id)
        normalized_parent_id = folder.id if folder else None

        entries = self.items.list_children(user_id, normalized_parent_id)
        print(f"Entries before sorting: {[entry.file_count for entry in entries]}")
        assets_by_item_id = {
            asset.item_id: asset for asset in self.assets.list_for_items([entry.id for entry in entries])
        }
        folder_ids = [entry.id for entry in entries if entry.kind == ItemKind.FOLDER.value]
        children_count_by_parent_id = self.items.count_children_by_parent_ids(user_id, folder_ids)
        rows = [{"item": entry, "asset": assets_by_item_id.get(entry.id)} for entry in entries]
        rows = self.sort_policy.sort_rows(rows, sort_by, sort_order)

        folder_payload = {
            "id": folder.id if folder else "root",
            "name": folder.name if folder else "Data Room",
            "parent_id": folder.parent_id if folder else None,
        }
        return {
            "folder": folder_payload,
            "breadcrumbs": self._build_breadcrumbs(user_id, folder),
            "items": [
                self.serializer.as_resource(
                    row["item"],
                    row.get("asset"),
                    children_count_by_parent_id.get(row["item"].id, 0),
                )
                for row in rows
            ],
        }

    def search_items(
        self,
        user_id: str,
        query: str | None,
        limit: int,
        root_item_id: str | None = None,
    ) -> dict:
        normalized_query = self.name_resolver.normalize(str(query or ""))
        normalized_terms = [segment for segment in normalized_query.split(" ") if segment]
        normalized_limit = max(1, min(int(limit or 50), 100))
        normalized_root_item_id = self._normalize_parent_id(root_item_id)
        if normalized_root_item_id is None:
            entries = self.items.search_active_for_user(user_id, normalized_terms, normalized_limit)
        else:
            root_folder = self._resolve_parent_folder(user_id, normalized_root_item_id)
            if root_folder is None:
                entries = self.items.search_active_for_user(user_id, normalized_terms, normalized_limit)
            else:
                scoped_ids = self._collect_subtree_item_ids(user_id, root_folder.id)
                entries = self.items.search_active_for_user_in_ids(
                    user_id,
                    normalized_terms,
                    normalized_limit,
                    list(scoped_ids),
                )
        if not entries:
            return {"items": []}

        file_item_ids = [entry.id for entry in entries if entry.kind == ItemKind.FILE.value]
        assets_by_item_id = {
            asset.item_id: asset for asset in self.assets.list_for_items(file_item_ids)
        }
        folder_ids = [entry.id for entry in entries if entry.kind == ItemKind.FOLDER.value]
        children_count_by_parent_id = self.items.count_children_by_parent_ids(user_id, folder_ids)

        return {
            "items": [
                self.serializer.as_resource(
                    entry,
                    assets_by_item_id.get(entry.id),
                    children_count_by_parent_id.get(entry.id, 0),
                )
                for entry in entries
            ],
        }

    def _collect_subtree_item_ids(self, user_id: str, root_folder_id: str) -> set[str]:
        return set(self.items.list_subtree_ids_for_user(user_id, root_folder_id))

    def get_item(self, user_id: str, item_id: str) -> tuple[DataRoomItem, FileAsset | None]:
        item = self.items.get_for_user(user_id, item_id)
        if item is None:
            raise ApiError(404, "item_not_found", "Item not found.")
        asset = self.assets.get_for_item(item.id) if item.kind == ItemKind.FILE.value else None
        return item, asset

    def get_item_resource(self, user_id: str, item_id: str) -> dict:
        item, asset = self.get_item(user_id, item_id)
        return self.serializer.as_resource(item, asset, self._children_count_for_item(user_id, item))

    def resolve_content(self, user_id: str, item_id: str) -> tuple[DataRoomItem, FileAsset]:
        item, asset = self.get_item(user_id, item_id)
        if item.kind != ItemKind.FILE.value:
            raise ApiError(400, "unsupported_item_type", "Content preview is available only for files.")
        if asset is None or not asset.storage_path:
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        if not Path(asset.storage_path).exists():
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        return item, asset

    def import_from_google(
        self,
        user: User,
        google_file_id: str,
        target_folder_id: str | None,
    ) -> dict:
        target_folder = self._resolve_parent_folder(user.id, target_folder_id)
        connection = self.connections.get_active_for_user(user.id)
        if connection is None:
            raise ApiError(400, "google_not_connected", "Google Drive is not connected.")

        metadata = self.drive_service.get_file_metadata(self.db, connection, google_file_id)
        mime_type = metadata.get("mimeType")
        if isinstance(mime_type, str) and mime_type.startswith("application/vnd.google-apps"):
            raise ApiError(
                400,
                "invalid_request",
                "Google native files are not supported for import.",
            )

        declared_size = int(metadata["size"]) if metadata.get("size") else None
        max_size = int(self.config["MAX_IMPORT_FILE_SIZE_BYTES"])
        if declared_size is not None and declared_size > max_size:
            raise ApiError(413, "file_too_large", "Selected file exceeds size limit.")

        parent_id = target_folder.id if target_folder else None
        resolved_name, normalized_name = self._resolve_unique_name(
            user.id,
            parent_id,
            metadata.get("name") or google_file_id,
        )
        item = DataRoomItem(
            user_id=user.id,
            parent_id=parent_id,
            kind=ItemKind.FILE.value,
            name=resolved_name,
            normalized_name=normalized_name,
            status=ItemStatus.FAILED.value,
            size_bytes=self._normalize_size(declared_size),
        )
        self.items.save(item)
        asset = FileAsset(
            item_id=item.id,
            mime_type=mime_type,
            size_bytes=declared_size,
            storage_path=None,
            origin="google_drive",
            google_file_id=google_file_id,
            imported_at=None,
            checksum=None,
        )
        self.assets.save(asset)

        saved_path: str | None = None
        try:
            response = self.drive_service.download_file_stream(self.db, connection, google_file_id)
            saved_path, actual_size, checksum = self.storage_service.save_stream(
                user.id,
                item.id,
                item.name,
                response.iter_content(chunk_size=64 * 1024),
            )
            if actual_size > max_size:
                self.storage_service.delete_file(saved_path)
                raise ApiError(413, "file_too_large", "Selected file exceeds size limit.")

            asset.storage_path = saved_path
            asset.size_bytes = actual_size
            asset.checksum = checksum
            asset.imported_at = datetime.now(timezone.utc)
            item.status = ItemStatus.ACTIVE.value
            item.size_bytes = actual_size

            self.items.save(item)
            self.assets.save(asset)
            self._apply_size_delta_to_ancestors(user.id, parent_id, actual_size)
            return self.serializer.as_resource(item, asset, children_count=0)
        except Exception:  # noqa: BLE001
            if saved_path:
                self.storage_service.delete_file(saved_path)
            raise

    def upload_local_file(self, user_id: str, uploaded_file: FileStorage, target_folder_id: str | None) -> dict:
        if uploaded_file is None or not uploaded_file.filename:
            raise ApiError(400, "invalid_request", "file is required.")

        max_size = int(self.config["MAX_IMPORT_FILE_SIZE_BYTES"])
        declared_size = uploaded_file.content_length
        if declared_size is not None and declared_size > max_size:
            raise ApiError(413, "file_too_large", "Selected file exceeds size limit.")

        target_folder = self._resolve_parent_folder(user_id, target_folder_id)
        parent_id = target_folder.id if target_folder else None
        resolved_name, normalized_name = self._resolve_unique_name(user_id, parent_id, uploaded_file.filename)

        item = DataRoomItem(
            user_id=user_id,
            parent_id=parent_id,
            kind=ItemKind.FILE.value,
            name=resolved_name,
            normalized_name=normalized_name,
            status=ItemStatus.FAILED.value,
            size_bytes=0,
        )
        self.items.save(item)
        asset = FileAsset(
            item_id=item.id,
            mime_type=uploaded_file.mimetype,
            size_bytes=None,
            storage_path=None,
            origin="local_upload",
            google_file_id=None,
            imported_at=None,
            checksum=None,
        )
        self.assets.save(asset)

        saved_path: str | None = None
        try:
            saved_path, actual_size, checksum = self.storage_service.save_uploaded_file(
                user_id,
                item.id,
                item.name,
                uploaded_file.stream,
            )
            if actual_size > max_size:
                self.storage_service.delete_file(saved_path)
                raise ApiError(413, "file_too_large", "Selected file exceeds size limit.")

            asset.storage_path = saved_path
            asset.size_bytes = actual_size
            asset.checksum = checksum
            asset.imported_at = datetime.now(timezone.utc)
            item.status = ItemStatus.ACTIVE.value
            item.size_bytes = actual_size
            self.items.save(item)
            self.assets.save(asset)
            self._apply_size_delta_to_ancestors(user_id, parent_id, actual_size)
            return self.serializer.as_resource(item, asset, children_count=0)
        except Exception:  # noqa: BLE001
            if saved_path:
                self.storage_service.delete_file(saved_path)
            raise

    def move_item(self, user_id: str, item_id: str, target_folder_id: str | None) -> dict:
        item = self.items.get_for_user(user_id, item_id)
        if item is None:
            raise ApiError(404, "item_not_found", "Item not found.")
        target_folder = self._resolve_parent_folder(user_id, target_folder_id)
        new_parent_id = target_folder.id if target_folder else None
        if target_folder is not None:
            self.tree_guard.ensure_move_has_no_cycle(user_id, item, target_folder, self.items)

        old_parent_id = item.parent_id
        moved_size = self._normalize_size(item.size_bytes)

        resolved_name, normalized_name = self._resolve_unique_name(
            user_id,
            new_parent_id,
            item.name,
            exclude_item_id=item.id,
        )
        item.parent_id = new_parent_id
        item.name = resolved_name
        item.normalized_name = normalized_name
        item.updated_at = datetime.now(timezone.utc)
        self.items.save(item)
        if old_parent_id != new_parent_id:
            self._apply_size_delta_to_ancestors(user_id, old_parent_id, -moved_size)
            self._apply_size_delta_to_ancestors(user_id, new_parent_id, moved_size)
        asset = self.assets.get_for_item(item.id) if item.kind == ItemKind.FILE.value else None
        return self.serializer.as_resource(item, asset, self._children_count_for_item(user_id, item))

    def rename_item(self, user_id: str, item_id: str, name: str) -> dict:
        item = self.items.get_for_user(user_id, item_id)
        if item is None:
            raise ApiError(404, "item_not_found", "Item not found.")

        resolved_name, normalized_name = self._resolve_unique_name(
            user_id,
            item.parent_id,
            name,
            exclude_item_id=item.id,
        )
        item.name = resolved_name
        item.normalized_name = normalized_name
        item.updated_at = datetime.now(timezone.utc)
        self.items.save(item)

        asset = self.assets.get_for_item(item.id) if item.kind == ItemKind.FILE.value else None
        return self.serializer.as_resource(item, asset, self._children_count_for_item(user_id, item))

    def copy_item(
        self,
        user_id: str,
        item_id: str,
        target_folder_id: str | None,
        created_paths_sink: list[str] | None = None,
    ) -> dict:
        source = self.items.get_for_user(user_id, item_id)
        if source is None:
            raise ApiError(404, "item_not_found", "Item not found.")
        target_folder = self._resolve_parent_folder(user_id, target_folder_id)
        target_parent_id = target_folder.id if target_folder else None
        if target_folder is not None:
            self.tree_guard.ensure_move_has_no_cycle(user_id, source, target_folder, self.items)

        created_paths: list[str] = []
        try:
            copied, copied_size = self._copy_recursive(user_id, source, target_parent_id, created_paths)
            self._apply_size_delta_to_ancestors(user_id, target_parent_id, copied_size)
            copied_asset = self.assets.get_for_item(copied.id) if copied.kind == ItemKind.FILE.value else None
            if created_paths_sink is not None:
                created_paths_sink.extend(created_paths)
            return self.serializer.as_resource(
                copied,
                copied_asset,
                self._children_count_for_item(user_id, copied),
            )
        except Exception:  # noqa: BLE001
            for path in created_paths:
                self.storage_service.delete_file(path)
            raise

    def _copy_recursive(
        self,
        user_id: str,
        source: DataRoomItem,
        target_parent_id: str | None,
        created_paths: list[str],
    ) -> tuple[DataRoomItem, int]:
        resolved_name, normalized_name = self._resolve_unique_name(user_id, target_parent_id, source.name)
        copied = DataRoomItem(
            user_id=user_id,
            parent_id=target_parent_id,
            kind=source.kind,
            name=resolved_name,
            normalized_name=normalized_name,
            status=ItemStatus.ACTIVE.value,
            size_bytes=0,
        )
        self.items.save(copied)

        if source.kind == ItemKind.FILE.value:
            source_asset = self.assets.get_for_item(source.id)
            if source_asset is None or not source_asset.storage_path:
                raise ApiError(410, "file_content_missing", "File content is no longer available.")
            if not Path(source_asset.storage_path).exists():
                raise ApiError(410, "file_content_missing", "File content is no longer available.")

            new_path, new_size, new_checksum = self.storage_service.copy_file(
                user_id,
                source_asset.storage_path,
                copied.id,
                copied.name,
            )
            created_paths.append(new_path)
            copied_asset = FileAsset(
                item_id=copied.id,
                mime_type=source_asset.mime_type,
                size_bytes=new_size,
                storage_path=new_path,
                origin="copied",
                google_file_id=None,
                imported_at=datetime.now(timezone.utc),
                checksum=new_checksum,
            )
            copied.size_bytes = new_size
            self.items.save(copied)
            self.assets.save(copied_asset)
            return copied, new_size

        children = self.items.list_children(user_id, source.id)
        subtree_size = 0
        for child in children:
            _, child_size = self._copy_recursive(user_id, child, copied.id, created_paths)
            subtree_size += child_size
        copied.size_bytes = subtree_size
        self.items.save(copied)
        return copied, subtree_size

    def delete_item(self, user_id: str, item_id: str) -> dict:
        root = self.items.get_for_user(user_id, item_id)
        if root is None:
            raise ApiError(404, "item_not_found", "Item not found.")

        removed_size = self._normalize_size(root.size_bytes)
        root_parent_id = root.parent_id
        now = datetime.now(timezone.utc)

        # Fast path: deleting a single file does not require loading the full tree.
        if root.kind == ItemKind.FILE.value:
            root.status = ItemStatus.DELETED.value
            root.size_bytes = 0
            root.updated_at = now

            asset = self.assets.get_for_item(root.id)
            if asset is not None:
                self.storage_service.delete_file(asset.storage_path)
                asset.storage_path = None
                asset.size_bytes = None

            self._apply_size_delta_to_ancestors(user_id, root_parent_id, -removed_size)
            return {"id": root.id, "status": ItemStatus.DELETED.value}

        # Fast path: empty folders can be deleted without scanning all items.
        if root.kind == ItemKind.FOLDER.value and self.items.count_children(user_id, root.id) == 0:
            root.status = ItemStatus.DELETED.value
            root.size_bytes = 0
            root.updated_at = now

            self._apply_size_delta_to_ancestors(user_id, root_parent_id, -removed_size)
            return {"id": root.id, "status": ItemStatus.DELETED.value}

        subtree = self._collect_subtree(user_id, root)
        assets_by_item = {
            asset.item_id: asset for asset in self.assets.list_for_items([item.id for item in subtree if item.kind == ItemKind.FILE.value])
        }

        for node in subtree:
            node.status = ItemStatus.DELETED.value
            node.size_bytes = 0
            node.updated_at = now
            if node.kind == ItemKind.FILE.value:
                asset = assets_by_item.get(node.id)
                if asset is None:
                    continue
                self.storage_service.delete_file(asset.storage_path)
                asset.storage_path = None
                asset.size_bytes = None

        self._apply_size_delta_to_ancestors(user_id, root_parent_id, -removed_size)

        return {"id": root.id, "status": ItemStatus.DELETED.value}

    def _collect_subtree(self, user_id: str, root: DataRoomItem) -> list[DataRoomItem]:
        subtree_ids = self.items.list_subtree_ids_for_user(user_id, root.id)
        if not subtree_ids:
            return [root]

        subtree_items = self.items.list_for_user_ids(user_id, subtree_ids, include_deleted=False)
        by_id = {item.id: item for item in subtree_items}
        ordered = [by_id[item_id] for item_id in subtree_ids if item_id in by_id]
        return ordered or [root]
