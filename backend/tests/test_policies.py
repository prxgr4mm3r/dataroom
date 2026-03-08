from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.errors import ApiError
from app.models import DataRoomItem
from app.services.policies import NameConflictResolver, SortPolicy, TreeGuard


class _StubRepo:
    def __init__(self, items: dict[str, DataRoomItem]):
        self.items = items

    def get_for_user(self, user_id: str, item_id: str, include_deleted: bool = False):
        item = self.items.get(item_id)
        if item and item.user_id == user_id:
            return item
        return None


class _Asset:
    def __init__(self, mime_type=None, size_bytes=None, imported_at=None):
        self.mime_type = mime_type
        self.size_bytes = size_bytes
        self.imported_at = imported_at


class PolicyTests(unittest.TestCase):
    def test_name_conflict_resolver_handles_extension_suffixes(self):
        resolver = NameConflictResolver()
        existing = {
            resolver.normalize("file.pdf"),
            resolver.normalize("file (1).pdf"),
        }
        self.assertEqual("file (2).pdf", resolver.resolve_unique("file.pdf", existing))

    def test_tree_guard_detects_move_cycle(self):
        user_id = "u1"
        root = DataRoomItem(id="root1", user_id=user_id, parent_id=None, kind="folder", name="A", normalized_name="a", status="active")
        child = DataRoomItem(id="child1", user_id=user_id, parent_id="root1", kind="folder", name="B", normalized_name="b", status="active")
        repo = _StubRepo({"root1": root, "child1": child})

        with self.assertRaises(ApiError) as err:
            TreeGuard().ensure_move_has_no_cycle(user_id, root, child, repo)
        self.assertEqual("invalid_move_cycle", err.exception.code)

    def test_sort_policy_keeps_folders_first(self):
        now = datetime.now(timezone.utc)
        folder = DataRoomItem(id="f1", user_id="u", parent_id=None, kind="folder", name="zz", normalized_name="zz", status="active")
        file_small = DataRoomItem(id="i1", user_id="u", parent_id=None, kind="file", name="a", normalized_name="a", status="active")
        file_big = DataRoomItem(id="i2", user_id="u", parent_id=None, kind="file", name="b", normalized_name="b", status="active")

        rows = [
            {"item": file_big, "asset": _Asset(size_bytes=10, imported_at=now)},
            {"item": folder, "asset": None},
            {"item": file_small, "asset": _Asset(size_bytes=1, imported_at=now)},
        ]

        sorted_rows = SortPolicy().sort_rows(rows, sort_by="size", sort_order="asc")
        self.assertEqual("folder", sorted_rows[0]["item"].kind)
        self.assertEqual("i1", sorted_rows[1]["item"].id)
        self.assertEqual("i2", sorted_rows[2]["item"].id)

    def test_sort_policy_supports_updated_at(self):
        now = datetime.now(timezone.utc)
        older = now.replace(year=now.year - 1)

        folder = DataRoomItem(id="f1", user_id="u", parent_id=None, kind="folder", name="folder", normalized_name="folder", status="active")
        file_old = DataRoomItem(id="i1", user_id="u", parent_id=None, kind="file", name="old", normalized_name="old", status="active")
        file_new = DataRoomItem(id="i2", user_id="u", parent_id=None, kind="file", name="new", normalized_name="new", status="active")

        folder.updated_at = now
        file_old.updated_at = older
        file_new.updated_at = now

        rows = [
            {"item": file_new, "asset": _Asset()},
            {"item": folder, "asset": None},
            {"item": file_old, "asset": _Asset()},
        ]

        sorted_rows = SortPolicy().sort_rows(rows, sort_by="updated_at", sort_order="asc")
        self.assertEqual("f1", sorted_rows[0]["item"].id)
        self.assertEqual("i1", sorted_rows[1]["item"].id)
        self.assertEqual("i2", sorted_rows[2]["item"].id)


if __name__ == "__main__":
    unittest.main()
