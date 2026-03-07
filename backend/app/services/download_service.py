from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import DataRoomItem, FileAsset, ItemKind
from app.repositories import FileAssetRepository, ItemRepository
from app.services.policies import NameConflictResolver


@dataclass
class DownloadEntry:
    source_path: str
    archive_path: str


@dataclass
class DownloadPayload:
    file_path: str
    mime_type: str
    download_name: str
    temporary: bool = False


class DownloadService:
    def __init__(self, db: Session):
        self.items = ItemRepository(db)
        self.assets = FileAssetRepository(db)
        self.name_resolver = NameConflictResolver()

    @staticmethod
    def _sanitize_ids(item_ids: list[str]) -> list[str]:
        normalized: list[str] = []
        for item_id in item_ids:
            value = str(item_id).strip()
            if not value:
                continue
            normalized.append(value)
        unique_ids = list(dict.fromkeys(normalized))
        if not unique_ids:
            raise ApiError(400, "invalid_request", "item_ids must contain at least one id.")
        return unique_ids

    @staticmethod
    def _sanitize_archive_part(name: str, fallback: str) -> str:
        value = name.strip().replace("/", "_").replace("\\", "_")
        if value in {"", ".", ".."}:
            value = fallback
        return value

    def _resolve_unique_name(self, requested_name: str, existing: set[str]) -> str:
        resolved = self.name_resolver.resolve_unique(requested_name, existing)
        existing.add(self.name_resolver.normalize(resolved))
        return resolved

    @staticmethod
    def _ensure_asset_path(asset: FileAsset | None) -> str:
        if asset is None or not asset.storage_path:
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        if not Path(asset.storage_path).exists():
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        return asset.storage_path

    def _collect_folder_files(
        self,
        root_folder: DataRoomItem,
        root_archive_path: str,
        children_by_parent: dict[str | None, list[DataRoomItem]],
    ) -> tuple[list[tuple[str, str]], list[str]]:
        file_specs: list[tuple[str, str]] = []
        empty_dirs: list[str] = []
        stack: list[tuple[DataRoomItem, PurePosixPath]] = [(root_folder, PurePosixPath(root_archive_path))]

        while stack:
            folder, folder_path = stack.pop()
            children = list(children_by_parent.get(folder.id, []))
            children.sort(key=lambda item: item.name.casefold())

            if not children:
                empty_dirs.append(folder_path.as_posix())
                continue

            resolved_names: dict[str, str] = {}
            used_names: set[str] = set()
            for child in children:
                fallback = f"{child.kind}-{child.id}"
                sanitized = self._sanitize_archive_part(child.name, fallback)
                resolved_names[child.id] = self._resolve_unique_name(sanitized, used_names)

            for child in reversed(children):
                child_name = resolved_names[child.id]
                archive_path = (folder_path / child_name).as_posix()
                if child.kind == ItemKind.FILE.value:
                    file_specs.append((child.id, archive_path))
                else:
                    stack.append((child, PurePosixPath(archive_path)))

        return file_specs, empty_dirs

    def _prepare_zip_entries(
        self,
        selected_items: list[DataRoomItem],
        children_by_parent: dict[str | None, list[DataRoomItem]],
    ) -> tuple[list[DownloadEntry], list[str]]:
        file_specs: list[tuple[str, str]] = []
        empty_dirs: list[str] = []

        root_used_names: set[str] = set()
        for item in selected_items:
            fallback = f"{item.kind}-{item.id}"
            root_name = self._sanitize_archive_part(item.name, fallback)
            root_archive_name = self._resolve_unique_name(root_name, root_used_names)

            if item.kind == ItemKind.FILE.value:
                file_specs.append((item.id, root_archive_name))
                continue

            folder_files, folder_empty_dirs = self._collect_folder_files(item, root_archive_name, children_by_parent)
            file_specs.extend(folder_files)
            empty_dirs.extend(folder_empty_dirs)

        assets_by_item_id = {
            asset.item_id: asset for asset in self.assets.list_for_items([item_id for item_id, _ in file_specs])
        }
        entries: list[DownloadEntry] = []
        for item_id, archive_path in file_specs:
            source_path = self._ensure_asset_path(assets_by_item_id.get(item_id))
            entries.append(DownloadEntry(source_path=source_path, archive_path=archive_path))

        return entries, empty_dirs

    @staticmethod
    def _build_zip(entries: list[DownloadEntry], empty_dirs: list[str]) -> str:
        fd, zip_path = tempfile.mkstemp(prefix="dataroom-download-", suffix=".zip")
        os.close(fd)
        Path(zip_path).unlink(missing_ok=True)

        try:
            with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
                for dir_path in sorted(set(empty_dirs), key=str.casefold):
                    archive.writestr(f"{dir_path.rstrip('/')}/", b"")
                for entry in sorted(entries, key=lambda value: value.archive_path.casefold()):
                    archive.write(entry.source_path, arcname=entry.archive_path)
        except Exception:  # noqa: BLE001
            Path(zip_path).unlink(missing_ok=True)
            raise

        return zip_path

    @staticmethod
    def _resolve_zip_name(selected_items: list[DataRoomItem]) -> str:
        if len(selected_items) == 1 and selected_items[0].kind == ItemKind.FOLDER.value:
            return f"{selected_items[0].name}.zip"
        return "dataroom-download.zip"

    def prepare_download(self, user_id: str, item_ids: list[str]) -> DownloadPayload:
        ids = self._sanitize_ids(item_ids)
        selected = self.items.list_for_user_ids(user_id, ids)
        selected_by_id = {item.id: item for item in selected}
        if len(selected_by_id) != len(ids):
            raise ApiError(404, "item_not_found", "Item not found.")

        selected_items = [selected_by_id[item_id] for item_id in ids]
        if len(selected_items) == 1 and selected_items[0].kind == ItemKind.FILE.value:
            item = selected_items[0]
            asset = self.assets.get_for_item(item.id)
            source_path = self._ensure_asset_path(asset)
            return DownloadPayload(
                file_path=source_path,
                mime_type=(asset.mime_type if asset and asset.mime_type else "application/octet-stream"),
                download_name=item.name,
                temporary=False,
            )

        all_items = self.items.list_active_for_user(user_id)
        children_by_parent: dict[str | None, list[DataRoomItem]] = {}
        for item in all_items:
            children_by_parent.setdefault(item.parent_id, []).append(item)

        entries, empty_dirs = self._prepare_zip_entries(selected_items, children_by_parent)
        zip_path = self._build_zip(entries, empty_dirs)
        return DownloadPayload(
            file_path=zip_path,
            mime_type="application/zip",
            download_name=self._resolve_zip_name(selected_items),
            temporary=True,
        )
