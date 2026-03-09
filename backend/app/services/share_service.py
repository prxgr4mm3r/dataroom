from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from collections import deque
import hashlib
import hmac
from pathlib import Path
import secrets
from typing import Any

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import DataRoomItem, FileAsset, ItemKind, ItemStatus, ShareLink, SharePermission
from app.repositories import FileAssetRepository, ItemRepository, ShareLinkRepository
from app.services.download_service import DownloadService, DownloadPayload
from app.services.policies import ItemSerializer, NameConflictResolver, SortPolicy
from app.services.token_cipher import TokenCipher


@dataclass
class ShareScope:
    link: ShareLink
    root_item: DataRoomItem | None

    @property
    def owner_user_id(self) -> str:
        return self.link.owner_user_id

    @property
    def is_root_scope(self) -> bool:
        return self.root_item is None


class ShareService:
    ROOT_SCOPE_ID = "root"
    ROOT_SCOPE_NAME = "Data Room"

    def __init__(self, db: Session, config: dict[str, Any]):
        self.db = db
        self.config = config
        self.items = ItemRepository(db)
        self.assets = FileAssetRepository(db)
        self.links = ShareLinkRepository(db)
        self.serializer = ItemSerializer()
        self.name_resolver = NameConflictResolver()
        self.sort_policy = SortPolicy()
        self.downloads = DownloadService(db)
        self.token_cipher = TokenCipher(str(config.get("TOKEN_ENCRYPTION_KEY") or ""))

    @staticmethod
    def _share_not_found() -> ApiError:
        return ApiError(404, "share_not_found", "Share link not found.")

    @staticmethod
    def _normalize_parent_id(parent_id: str | None) -> str | None:
        if parent_id in (None, "", "root", "null"):
            return None
        return parent_id

    @classmethod
    def _is_root_scope_id(cls, value: str | None) -> bool:
        normalized = str(value or "").strip().casefold()
        return normalized == cls.ROOT_SCOPE_ID

    @staticmethod
    def _sanitize_item_ids(item_ids: list[str]) -> list[str]:
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

    def _hash_token(self, token_kid: str, token_secret: str) -> str:
        pepper = str(self.config.get("SHARE_TOKEN_PEPPER") or "").encode("utf-8")
        payload = f"{token_kid}.{token_secret}".encode("utf-8")
        return hmac.new(pepper, payload, hashlib.sha256).hexdigest()

    @staticmethod
    def _parse_raw_token(raw_token: str) -> tuple[str, str]:
        token = str(raw_token or "").strip()
        if "." not in token:
            raise ShareService._share_not_found()
        token_kid, token_secret = token.split(".", 1)
        if not token_kid or not token_secret:
            raise ShareService._share_not_found()
        return token_kid, token_secret

    def _resolve_expiry(self, expires_in_days: int | None) -> datetime | None:
        if expires_in_days is None:
            expires_in_days = int(self.config.get("SHARE_DEFAULT_TTL_DAYS", 30))

        if expires_in_days <= 0:
            return None

        max_days = int(self.config.get("SHARE_MAX_TTL_DAYS", 365))
        if expires_in_days > max_days:
            raise ApiError(400, "invalid_request", f"expires_in_days must be <= {max_days}.")

        return datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    @staticmethod
    def _ensure_active_share_root(root_item: DataRoomItem | None) -> DataRoomItem:
        if root_item is None:
            raise ShareService._share_not_found()
        return root_item

    def _is_item_in_scope(self, scope: ShareScope, item: DataRoomItem) -> bool:
        if scope.is_root_scope:
            return True

        if scope.root_item is None:
            return False

        cursor: DataRoomItem | None = item
        visited: set[str] = set()
        while cursor is not None and cursor.id not in visited:
            if cursor.id == scope.root_item.id:
                return True
            visited.add(cursor.id)
            if cursor.parent_id is None:
                return False
            cursor = self.items.get_for_user(scope.owner_user_id, cursor.parent_id)
        return False

    def _resolve_scope(self, raw_token: str, *, touch_access: bool = True) -> ShareScope:
        token_kid, token_secret = self._parse_raw_token(raw_token)
        link = self.links.get_by_kid(token_kid)
        if link is None:
            raise self._share_not_found()

        now = datetime.now(timezone.utc)
        if link.revoked_at is not None:
            raise self._share_not_found()
        if link.expires_at is not None:
            expiry_at = link.expires_at
            if expiry_at.tzinfo is None:
                expiry_at = expiry_at.replace(tzinfo=timezone.utc)
            if expiry_at <= now:
                raise self._share_not_found()
        if link.permission != SharePermission.READ:
            raise self._share_not_found()

        expected_hash = self._hash_token(token_kid, token_secret)
        if not hmac.compare_digest(link.token_hash, expected_hash):
            raise self._share_not_found()

        root_item: DataRoomItem | None
        if link.root_item_id is None:
            root_item = None
        else:
            root_item = self._ensure_active_share_root(
                self.items.get_for_user(link.owner_user_id, link.root_item_id),
            )
        if touch_access:
            link.last_access_at = now
            self.links.save(link)
        return ShareScope(link=link, root_item=root_item)

    def _collect_scope_item_ids(self, scope: ShareScope) -> set[str]:
        if scope.is_root_scope:
            return set()
        if scope.root_item is None:
            raise self._share_not_found()
        if scope.root_item.kind == ItemKind.FILE.value:
            return {scope.root_item.id}

        scoped_ids: set[str] = set()
        queue: deque[str] = deque([scope.root_item.id])
        while queue:
            parent_id = queue.popleft()
            if parent_id in scoped_ids:
                continue
            scoped_ids.add(parent_id)

            children = self.items.list_children(scope.owner_user_id, parent_id)
            for child in children:
                scoped_ids.add(child.id)
                if child.kind == ItemKind.FOLDER.value:
                    queue.append(child.id)
        return scoped_ids

    @staticmethod
    def _to_share_url(frontend_url: str, raw_token: str) -> str:
        return f"{frontend_url.rstrip('/')}/s/{raw_token}"

    def _try_restore_share_url(self, link: ShareLink) -> str | None:
        if not link.token_secret_encrypted:
            return None
        try:
            token_secret = self.token_cipher.decrypt(link.token_secret_encrypted)
        except Exception:  # noqa: BLE001
            return None
        return self._to_share_url(
            self.config["FRONTEND_URL"],
            f"{link.token_kid}.{token_secret}",
        )

    def _serialize_owner_link(self, link: ShareLink, share_url: str | None = None) -> dict[str, Any]:
        resolved_url = share_url if share_url is not None else self._try_restore_share_url(link)
        return {
            "id": link.id,
            "permission": link.permission,
            "root_item_id": link.root_item_id or self.ROOT_SCOPE_ID,
            "expires_at": link.expires_at.isoformat() if link.expires_at else None,
            "created_at": link.created_at.isoformat(),
            "updated_at": link.updated_at.isoformat(),
            "revoked_at": link.revoked_at.isoformat() if link.revoked_at else None,
            "last_access_at": link.last_access_at.isoformat() if link.last_access_at else None,
            "share_url": resolved_url,
        }

    def create_readonly_link(
        self,
        owner_user_id: str,
        root_item_id: str,
        expires_in_days: int | None = None,
    ) -> dict[str, Any]:
        normalized_item_id = str(root_item_id).strip()
        is_root_scope = self._is_root_scope_id(normalized_item_id)

        resolved_root_item_id: str | None
        if is_root_scope:
            resolved_root_item_id = None
        else:
            root_item = self.items.get_for_user(owner_user_id, normalized_item_id)
            if root_item is None:
                raise ApiError(404, "item_not_found", "Item not found.")
            resolved_root_item_id = root_item.id

        existing_links = self.links.list_for_owner(
            owner_user_id,
            root_item_id=resolved_root_item_id,
            include_revoked=False,
            root_scope_only=True if is_root_scope else None,
        )
        if existing_links:
            now = datetime.now(timezone.utc)
            selected: tuple[ShareLink, str] | None = None

            for link in existing_links:
                restored_url = self._try_restore_share_url(link)
                if selected is None and restored_url:
                    selected = (link, restored_url)
                    continue
                link.revoked_at = now
                self.links.save(link)

            if selected is not None:
                selected_link, selected_url = selected
                response = self._serialize_owner_link(selected_link, selected_url)
                response.pop("updated_at", None)
                response.pop("revoked_at", None)
                response.pop("last_access_at", None)
                return response

        token_kid = secrets.token_urlsafe(int(self.config.get("SHARE_TOKEN_KID_BYTES", 9)))
        token_secret = secrets.token_urlsafe(int(self.config.get("SHARE_TOKEN_SECRET_BYTES", 32)))
        token_hash = self._hash_token(token_kid, token_secret)
        raw_token = f"{token_kid}.{token_secret}"
        expires_at = self._resolve_expiry(expires_in_days)

        link = ShareLink(
            owner_user_id=owner_user_id,
            root_item_id=resolved_root_item_id,
            permission=SharePermission.READ,
            token_kid=token_kid,
            token_hash=token_hash,
            token_secret_encrypted=self.token_cipher.encrypt(token_secret),
            expires_at=expires_at,
            revoked_at=None,
            last_access_at=None,
        )
        self.links.save(link)
        response = self._serialize_owner_link(
            link,
            self._to_share_url(self.config["FRONTEND_URL"], raw_token),
        )
        response.pop("updated_at", None)
        response.pop("revoked_at", None)
        response.pop("last_access_at", None)
        return response

    def list_links(
        self,
        owner_user_id: str,
        root_item_id: str | None = None,
        include_revoked: bool = False,
    ) -> list[dict[str, Any]]:
        normalized_item_id = str(root_item_id).strip() if root_item_id is not None else None
        root_scope_only: bool | None = None
        filter_item_id: str | None = None

        if normalized_item_id:
            if self._is_root_scope_id(normalized_item_id):
                root_scope_only = True
            else:
                root_item = self.items.get_for_user(owner_user_id, normalized_item_id)
                if root_item is None:
                    raise ApiError(404, "item_not_found", "Item not found.")
                filter_item_id = root_item.id

        links = self.links.list_for_owner(
            owner_user_id=owner_user_id,
            root_item_id=filter_item_id,
            include_revoked=include_revoked,
            root_scope_only=root_scope_only,
        )

        result: list[dict[str, Any]] = []
        for link in links:
            result.append(self._serialize_owner_link(link))
        return result

    def revoke_link(self, owner_user_id: str, share_id: str) -> dict[str, Any]:
        link = self.links.get_by_id_for_owner(owner_user_id, share_id)
        if link is None:
            raise ApiError(404, "share_not_found", "Share link not found.")
        if link.revoked_at is None:
            link.revoked_at = datetime.now(timezone.utc)
            self.links.save(link)
        return {
            "id": link.id,
            "revoked_at": link.revoked_at.isoformat() if link.revoked_at else None,
        }

    def _resolve_folder_for_listing(self, scope: ShareScope, parent_id: str | None) -> DataRoomItem | None:
        normalized_parent = self._normalize_parent_id(parent_id)

        if scope.is_root_scope:
            if normalized_parent is None:
                return None

            folder = self.items.get_for_user(scope.owner_user_id, normalized_parent)
            if folder is None or folder.kind != ItemKind.FOLDER.value:
                raise self._share_not_found()
            return folder

        if scope.root_item is None:
            raise self._share_not_found()

        if scope.root_item.kind == ItemKind.FILE.value:
            if normalized_parent is None or normalized_parent == scope.root_item.id:
                return None
            raise self._share_not_found()

        if normalized_parent is None or normalized_parent == scope.root_item.id:
            return scope.root_item

        folder = self.items.get_for_user(scope.owner_user_id, normalized_parent)
        if folder is None or folder.kind != ItemKind.FOLDER.value:
            raise self._share_not_found()
        if not self._is_item_in_scope(scope, folder):
            raise self._share_not_found()
        return folder

    def _build_scoped_breadcrumbs(self, scope: ShareScope, folder: DataRoomItem | None) -> list[dict[str, str]]:
        if scope.is_root_scope:
            if folder is None:
                return [{"id": "root", "name": self.ROOT_SCOPE_NAME}]

            chain: list[DataRoomItem] = []
            cursor: DataRoomItem | None = folder
            while cursor is not None:
                chain.append(cursor)
                if cursor.parent_id is None:
                    break
                cursor = self.items.get_for_user(scope.owner_user_id, cursor.parent_id)

            if not chain or chain[-1].parent_id is not None:
                raise self._share_not_found()

            breadcrumbs = [{"id": "root", "name": self.ROOT_SCOPE_NAME}]
            for node in reversed(chain):
                breadcrumbs.append({"id": node.id, "name": node.name})
            return breadcrumbs

        if scope.root_item is None:
            raise self._share_not_found()

        if folder is None or folder.id == scope.root_item.id:
            return [{"id": "root", "name": scope.root_item.name}]

        chain: list[DataRoomItem] = []
        cursor: DataRoomItem | None = folder
        while cursor is not None and cursor.id != scope.root_item.id:
            chain.append(cursor)
            if cursor.parent_id is None:
                raise self._share_not_found()
            cursor = self.items.get_for_user(scope.owner_user_id, cursor.parent_id)

        if cursor is None:
            raise self._share_not_found()

        breadcrumbs = [{"id": "root", "name": scope.root_item.name}]
        for node in reversed(chain):
            breadcrumbs.append({"id": node.id, "name": node.name})
        return breadcrumbs

    def get_meta(self, raw_token: str) -> dict[str, Any]:
        scope = self._resolve_scope(raw_token)
        if scope.is_root_scope:
            top_level_items = self.items.list_children(scope.owner_user_id, None)
            root_size_bytes = sum(max(0, int(item.size_bytes or 0)) for item in top_level_items)
            root_resource: dict[str, Any] = {
                "id": self.ROOT_SCOPE_ID,
                "kind": ItemKind.FOLDER.value,
                "name": self.ROOT_SCOPE_NAME,
                "parent_id": None,
                "status": ItemStatus.ACTIVE.value,
                "created_at": scope.link.created_at.isoformat(),
                "updated_at": scope.link.updated_at.isoformat(),
                "children_count": len(top_level_items),
                "size_bytes": root_size_bytes,
            }
        else:
            if scope.root_item is None:
                raise self._share_not_found()
            root = scope.root_item
            root_asset = self.assets.get_for_item(root.id) if root.kind == ItemKind.FILE.value else None
            root_children_count = self.items.count_children(scope.owner_user_id, root.id) if root.kind == ItemKind.FOLDER.value else 0
            root_resource = self.serializer.as_resource(root, root_asset, children_count=root_children_count)

        return {
            "share": {
                "id": scope.link.id,
                "permission": scope.link.permission,
                "expires_at": scope.link.expires_at.isoformat() if scope.link.expires_at else None,
                "created_at": scope.link.created_at.isoformat(),
            },
            "root": root_resource,
        }

    def list_items(
        self,
        raw_token: str,
        parent_id: str | None,
        sort_by: str,
        sort_order: str,
    ) -> dict[str, Any]:
        scope = self._resolve_scope(raw_token)
        folder = self._resolve_folder_for_listing(scope, parent_id)

        if scope.is_root_scope:
            entries = self.items.list_children(scope.owner_user_id, folder.id if folder else None)
            if folder is None:
                folder_payload = {
                    "id": self.ROOT_SCOPE_ID,
                    "name": self.ROOT_SCOPE_NAME,
                    "parent_id": None,
                }
            else:
                folder_payload = {
                    "id": folder.id,
                    "name": folder.name,
                    "parent_id": self.ROOT_SCOPE_ID if folder.parent_id is None else folder.parent_id,
                }
        else:
            if scope.root_item is None:
                raise self._share_not_found()

            if folder is None:
                root_item = scope.root_item
                asset = self.assets.get_for_item(root_item.id) if root_item.kind == ItemKind.FILE.value else None
                return {
                    "folder": {
                        "id": "root",
                        "name": root_item.name,
                        "parent_id": None,
                    },
                    "breadcrumbs": [{"id": "root", "name": root_item.name}],
                    "items": [
                        self.serializer.as_resource(root_item, asset, children_count=0),
                    ],
                }

            entries = self.items.list_children(scope.owner_user_id, folder.id)

            parent_ref: str | None
            if folder.id == scope.root_item.id:
                parent_ref = None
                folder_id = "root"
            else:
                folder_id = folder.id
                parent_ref = "root" if folder.parent_id == scope.root_item.id else folder.parent_id

            folder_payload = {
                "id": folder_id,
                "name": folder.name,
                "parent_id": parent_ref,
            }

        assets_by_item_id = {
            asset.item_id: asset for asset in self.assets.list_for_items([entry.id for entry in entries])
        }
        folder_ids = [entry.id for entry in entries if entry.kind == ItemKind.FOLDER.value]
        children_count_by_parent_id = self.items.count_children_by_parent_ids(scope.owner_user_id, folder_ids)
        rows = [{"item": entry, "asset": assets_by_item_id.get(entry.id)} for entry in entries]
        rows = self.sort_policy.sort_rows(rows, sort_by, sort_order)

        return {
            "folder": folder_payload,
            "breadcrumbs": self._build_scoped_breadcrumbs(scope, folder),
            "items": [
                self.serializer.as_resource(
                    row["item"],
                    row.get("asset"),
                    children_count_by_parent_id.get(row["item"].id, 0),
                )
                for row in rows
            ],
        }

    def search_items(self, raw_token: str, query: str | None, limit: int) -> dict[str, Any]:
        scope = self._resolve_scope(raw_token, touch_access=False)
        normalized_query = self.name_resolver.normalize(str(query or ""))
        normalized_terms = [segment for segment in normalized_query.split(" ") if segment]
        normalized_limit = max(1, min(int(limit or 50), 100))
        if scope.is_root_scope:
            entries = self.items.search_active_for_user(scope.owner_user_id, normalized_terms, normalized_limit)
        elif scope.root_item and scope.root_item.kind == ItemKind.FILE.value:
            is_match = all(term in scope.root_item.normalized_name for term in normalized_terms)
            entries = [scope.root_item] if is_match else []
        else:
            scoped_ids = self._collect_scope_item_ids(scope)
            entries = self.items.search_active_for_user_in_ids(
                scope.owner_user_id,
                normalized_terms,
                normalized_limit,
                list(scoped_ids),
            )

        if not entries:
            return {"items": []}

        file_item_ids = [item.id for item in entries if item.kind == ItemKind.FILE.value]
        assets_by_item_id = {
            asset.item_id: asset for asset in self.assets.list_for_items(file_item_ids)
        }

        folder_ids = [item.id for item in entries if item.kind == ItemKind.FOLDER.value]
        children_count_by_parent_id = self.items.count_children_by_parent_ids(scope.owner_user_id, folder_ids)

        return {
            "items": [
                self.serializer.as_resource(
                    item,
                    assets_by_item_id.get(item.id),
                    children_count_by_parent_id.get(item.id, 0),
                )
                for item in entries
            ],
        }

    def get_folder_tree(self, raw_token: str) -> dict[str, Any]:
        scope = self._resolve_scope(raw_token)
        if scope.is_root_scope:
            root_folder_id: str | None = None
            root_name = self.ROOT_SCOPE_NAME
        elif scope.root_item and scope.root_item.kind != ItemKind.FOLDER.value:
            return {
                "root": {
                    "id": "root",
                    "name": scope.root_item.name,
                    "children": [],
                }
            }
        elif scope.root_item:
            root_folder_id = scope.root_item.id
            root_name = scope.root_item.name
        else:
            raise self._share_not_found()

        folders = self.items.list_all_folders(scope.owner_user_id)
        children_by_parent: dict[str | None, list[DataRoomItem]] = {}
        for folder in folders:
            children_by_parent.setdefault(folder.parent_id, []).append(folder)
        for children in children_by_parent.values():
            children.sort(key=lambda f: f.name.casefold())

        def build(parent_id: str | None) -> list[dict[str, Any]]:
            result: list[dict[str, Any]] = []
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
                "name": root_name,
                "children": build(root_folder_id),
            }
        }

    def resolve_content(self, raw_token: str, item_id: str) -> tuple[DataRoomItem, FileAsset]:
        scope = self._resolve_scope(raw_token)
        item = self.items.get_for_user(scope.owner_user_id, item_id)
        if item is None or not self._is_item_in_scope(scope, item):
            raise self._share_not_found()
        if item.kind != ItemKind.FILE.value:
            raise ApiError(400, "unsupported_item_type", "Content preview is available only for files.")

        asset = self.assets.get_for_item(item.id)
        if asset is None or not asset.storage_path:
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        if not Path(asset.storage_path).exists():
            raise ApiError(410, "file_content_missing", "File content is no longer available.")
        return item, asset

    def resolve_item(self, raw_token: str, item_id: str) -> dict[str, Any]:
        scope = self._resolve_scope(raw_token)
        item = self.items.get_for_user(scope.owner_user_id, item_id)
        if item is None or not self._is_item_in_scope(scope, item):
            raise self._share_not_found()

        asset = self.assets.get_for_item(item.id) if item.kind == ItemKind.FILE.value else None
        children_count = self.items.count_children(scope.owner_user_id, item.id) if item.kind == ItemKind.FOLDER.value else 0
        return self.serializer.as_resource(item, asset, children_count=children_count)

    def prepare_download(self, raw_token: str, item_ids: list[str]) -> DownloadPayload:
        scope = self._resolve_scope(raw_token)
        normalized_ids = self._sanitize_item_ids(item_ids)
        selected_items = self.items.list_for_user_ids(scope.owner_user_id, normalized_ids)
        selected_by_id = {item.id: item for item in selected_items}
        if len(selected_by_id) != len(normalized_ids):
            raise self._share_not_found()

        ordered_selected = [selected_by_id[item_id] for item_id in normalized_ids]
        for item in ordered_selected:
            if not self._is_item_in_scope(scope, item):
                raise self._share_not_found()

        return self.downloads.prepare_download(scope.owner_user_id, normalized_ids)
