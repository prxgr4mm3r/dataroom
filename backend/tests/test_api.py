from __future__ import annotations

import io
import tempfile
import unittest
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from app import create_app
from app.errors import ApiError
from app.models import GoogleDriveConnection, User
from app.services.token_cipher import TokenCipher


class FakeGoogleDownloadResponse:
    def __init__(self, payload: bytes):
        self.payload = payload

    def iter_content(self, chunk_size: int = 64 * 1024):
        for idx in range(0, len(self.payload), chunk_size):
            yield self.payload[idx : idx + chunk_size]


class BackendApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.upload_dir = Path(self.tmpdir.name) / "uploads"
        self.db_path = Path(self.tmpdir.name) / "test.db"

        self.app = create_app(
            {
                "TESTING": True,
                "ALLOW_INSECURE_TEST_TOKENS": True,
                "AUTO_CREATE_SCHEMA": True,
                "DATABASE_URL": f"sqlite:///{self.db_path}",
                "UPLOAD_DIR": str(self.upload_dir),
                "TOKEN_ENCRYPTION_KEY": "test-encryption-key",
                "GOOGLE_CLIENT_ID": "google-client-id",
                "GOOGLE_CLIENT_SECRET": "google-client-secret",
                "GOOGLE_REDIRECT_URI": "http://localhost:5000/api/integrations/google/callback",
                "FRONTEND_URL": "http://localhost:5173",
            }
        )
        self.client = self.app.test_client()

    def tearDown(self) -> None:
        self.tmpdir.cleanup()

    @staticmethod
    def _auth_headers(uid: str = "user-a") -> dict[str, str]:
        return {
            "Authorization": f"Bearer test-token:{uid}:{uid}@example.com:{uid}",
        }

    def _get_user(self, uid: str) -> User:
        session_factory = self.app.extensions["session_factory"]
        db = session_factory()
        try:
            user = db.query(User).filter(User.firebase_uid == uid).one()
            db.expunge(user)
            return user
        finally:
            db.close()

    def _create_active_google_connection(self, uid: str, expired: bool = False) -> GoogleDriveConnection:
        self.client.get("/api/me", headers=self._auth_headers(uid))
        user = self._get_user(uid)

        session_factory = self.app.extensions["session_factory"]
        db = session_factory()
        try:
            cipher = TokenCipher(self.app.config["TOKEN_ENCRYPTION_KEY"])
            expiry = datetime.now(timezone.utc) - timedelta(minutes=5) if expired else datetime.now(timezone.utc) + timedelta(hours=1)
            conn = GoogleDriveConnection(
                user_id=user.id,
                google_sub=f"google-sub-{uid}",
                google_email=f"{uid}@gmail.com",
                access_token_encrypted=cipher.encrypt("access-token"),
                refresh_token_encrypted=cipher.encrypt("refresh-token"),
                token_expiry_at=expiry,
                scope="https://www.googleapis.com/auth/drive.readonly",
                is_active=True,
            )
            db.add(conn)
            db.commit()
            db.refresh(conn)
            db.expunge(conn)
            return conn
        finally:
            db.close()

    def test_me_requires_auth(self):
        response = self.client.get("/api/me")
        self.assertEqual(401, response.status_code)
        self.assertEqual("unauthorized", response.json["error"]["code"])

    def test_google_connect_returns_auth_url(self):
        response = self.client.post("/api/integrations/google/connect", headers=self._auth_headers("connect-user"))
        self.assertEqual(200, response.status_code)
        self.assertIn("accounts.google.com", response.json["auth_url"])
        self.assertIn("state=", response.json["auth_url"])

    def test_google_files_requires_connected_account(self):
        response = self.client.get("/api/integrations/google/files", headers=self._auth_headers("no-conn"))
        self.assertEqual(400, response.status_code)
        self.assertEqual("google_not_connected", response.json["error"]["code"])

    def test_google_files_supports_pagination_params(self):
        self._create_active_google_connection("drive-user")

        with patch("app.services.google_drive_service.GoogleDriveService.list_files") as list_files_mock:
            list_files_mock.return_value = {
                "files": [],
                "next_page_token": "tok-1",
            }
            response = self.client.get(
                "/api/integrations/google/files?page_size=20&page_token=abc&q=nda",
                headers=self._auth_headers("drive-user"),
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual("tok-1", response.json["next_page_token"])
        _, kwargs = list_files_mock.call_args
        self.assertEqual(20, kwargs["page_size"])
        self.assertEqual("abc", kwargs["page_token"])
        self.assertEqual("nda", kwargs["query"])

    def test_hard_switch_old_file_endpoints_removed(self):
        response = self.client.get("/api/files", headers=self._auth_headers("u-old"))
        self.assertEqual(404, response.status_code)

    def test_create_tree_list_and_breadcrumbs(self):
        headers = self._auth_headers("tree-user")

        contracts = self.client.post("/api/folders", headers=headers, json={"name": "Contracts"})
        self.assertEqual(201, contracts.status_code)
        contracts_id = contracts.json["id"]

        nested = self.client.post(
            "/api/folders",
            headers=headers,
            json={"parent_id": contracts_id, "name": "2026"},
        )
        self.assertEqual(201, nested.status_code)
        nested_id = nested.json["id"]

        tree = self.client.get("/api/folders/tree", headers=headers)
        self.assertEqual(200, tree.status_code)
        self.assertEqual("Data Room", tree.json["root"]["name"])

        root_items = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        self.assertEqual(200, root_items.status_code)
        self.assertEqual("root", root_items.json["folder"]["id"])
        self.assertEqual("Contracts", root_items.json["items"][0]["name"])
        self.assertEqual(1, root_items.json["items"][0]["children_count"])
        self.assertEqual(0, root_items.json["items"][0]["size_bytes"])

        nested_items = self.client.get(f"/api/items?parent_id={nested_id}", headers=headers)
        self.assertEqual(200, nested_items.status_code)
        self.assertEqual(3, len(nested_items.json["breadcrumbs"]))

    def test_import_upload_preview_move_copy_delete_and_bulk(self):
        headers = self._auth_headers("flow-user")
        self._create_active_google_connection("flow-user")

        folder_a = self.client.post("/api/folders", headers=headers, json={"name": "A"}).json["id"]
        folder_b = self.client.post("/api/folders", headers=headers, json={"name": "B"}).json["id"]

        with (
            patch(
                "app.services.google_drive_service.GoogleDriveService.get_file_metadata",
                return_value={
                    "id": "google-file-1",
                    "name": "nda.txt",
                    "mimeType": "text/plain",
                    "size": "11",
                },
            ),
            patch(
                "app.services.google_drive_service.GoogleDriveService.download_file_stream",
                return_value=FakeGoogleDownloadResponse(b"hello world"),
            ),
        ):
            imported = self.client.post(
                "/api/files/import-from-google",
                headers=headers,
                json={"google_file_id": "google-file-1", "target_folder_id": folder_a},
            )

        self.assertEqual(201, imported.status_code)
        imported_item_id = imported.json["id"]
        self.assertEqual(0, imported.json["children_count"])

        upload = self.client.post(
            "/api/files/upload",
            headers=headers,
            data={
                "file": (io.BytesIO(b"upload-content"), "report.pdf"),
                "target_folder_id": folder_a,
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(201, upload.status_code)
        uploaded_item_id = upload.json["id"]
        self.assertEqual(0, upload.json["children_count"])

        folder_a_listing = self.client.get(f"/api/items?parent_id={folder_a}&sort_by=name&sort_order=asc", headers=headers)
        self.assertEqual(200, folder_a_listing.status_code)
        folder_a_sizes = {item["name"]: item["size_bytes"] for item in folder_a_listing.json["items"]}
        self.assertEqual(11, folder_a_sizes["nda.txt"])
        self.assertEqual(14, folder_a_sizes["report.pdf"])

        root_after_upload = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        root_sizes_after_upload = {item["name"]: item["size_bytes"] for item in root_after_upload.json["items"]}
        self.assertEqual(25, root_sizes_after_upload["A"])
        self.assertEqual(0, root_sizes_after_upload["B"])

        content = self.client.get(f"/api/items/{imported_item_id}/content", headers=headers)
        self.assertEqual(200, content.status_code)
        self.assertIn(b"hello world", content.data)
        content.close()

        move_resp = self.client.patch(
            f"/api/items/{uploaded_item_id}/move",
            headers=headers,
            json={"target_folder_id": folder_b},
        )
        self.assertEqual(200, move_resp.status_code)
        self.assertEqual(folder_b, move_resp.json["parent_id"])
        self.assertEqual(0, move_resp.json["children_count"])

        root_after_move = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        root_sizes_after_move = {item["name"]: item["size_bytes"] for item in root_after_move.json["items"]}
        self.assertEqual(11, root_sizes_after_move["A"])
        self.assertEqual(14, root_sizes_after_move["B"])

        copy_resp = self.client.post(
            f"/api/items/{uploaded_item_id}/copy",
            headers=headers,
            json={"target_folder_id": folder_b},
        )
        self.assertEqual(201, copy_resp.status_code)
        copied_item_id = copy_resp.json["id"]
        self.assertNotEqual(uploaded_item_id, copied_item_id)
        self.assertEqual(0, copy_resp.json["children_count"])

        root_after_copy = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        root_sizes_after_copy = {item["name"]: item["size_bytes"] for item in root_after_copy.json["items"]}
        self.assertEqual(11, root_sizes_after_copy["A"])
        self.assertEqual(28, root_sizes_after_copy["B"])

        bulk_delete = self.client.post(
            "/api/items/bulk-delete",
            headers=headers,
            json={"item_ids": [uploaded_item_id, copied_item_id]},
        )
        self.assertEqual(200, bulk_delete.status_code)
        self.assertEqual(2, len(bulk_delete.json["items"]))

        root_after_bulk_delete = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        root_sizes_after_bulk_delete = {item["name"]: item["size_bytes"] for item in root_after_bulk_delete.json["items"]}
        self.assertEqual(11, root_sizes_after_bulk_delete["A"])
        self.assertEqual(0, root_sizes_after_bulk_delete["B"])

        delete_folder = self.client.delete(f"/api/items/{folder_a}", headers=headers)
        self.assertEqual(200, delete_folder.status_code)
        self.assertEqual("deleted", delete_folder.json["status"])

        root_after_folder_delete = self.client.get("/api/items?parent_id=root&sort_by=name&sort_order=asc", headers=headers)
        self.assertEqual(1, len(root_after_folder_delete.json["items"]))
        self.assertEqual("B", root_after_folder_delete.json["items"][0]["name"])
        self.assertEqual(0, root_after_folder_delete.json["items"][0]["size_bytes"])

    def test_folder_content_endpoint_returns_unsupported_item_type(self):
        headers = self._auth_headers("preview-user")
        folder = self.client.post("/api/folders", headers=headers, json={"name": "OnlyFolders"})
        folder_id = folder.json["id"]

        content = self.client.get(f"/api/items/{folder_id}/content", headers=headers)
        self.assertEqual(400, content.status_code)
        self.assertEqual("unsupported_item_type", content.json["error"]["code"])

    def test_download_single_file_folder_and_multi_items(self):
        headers = self._auth_headers("download-user")
        docs_folder = self.client.post("/api/folders", headers=headers, json={"name": "Docs"}).json["id"]
        self.client.post(
            "/api/folders",
            headers=headers,
            json={"name": "Empty", "parent_id": docs_folder},
        )
        archive_folder = self.client.post("/api/folders", headers=headers, json={"name": "Archive"}).json["id"]

        docs_file = self.client.post(
            "/api/files/upload",
            headers=headers,
            data={
                "file": (io.BytesIO(b"docs-content"), "note.txt"),
                "target_folder_id": docs_folder,
            },
            content_type="multipart/form-data",
        )
        archive_file = self.client.post(
            "/api/files/upload",
            headers=headers,
            data={
                "file": (io.BytesIO(b"archive-content"), "note.txt"),
                "target_folder_id": archive_folder,
            },
            content_type="multipart/form-data",
        )

        docs_file_id = docs_file.json["id"]
        archive_file_id = archive_file.json["id"]

        single_download = self.client.post(
            "/api/items/download",
            headers=headers,
            json={"item_ids": [docs_file_id]},
        )
        self.assertEqual(200, single_download.status_code)
        self.assertIn("filename=note.txt", single_download.headers.get("Content-Disposition", ""))
        self.assertEqual(b"docs-content", single_download.data)
        single_download.close()

        folder_download = self.client.post(
            "/api/items/download",
            headers=headers,
            json={"item_ids": [docs_folder]},
        )
        self.assertEqual(200, folder_download.status_code)
        self.assertIn("filename=Docs.zip", folder_download.headers.get("Content-Disposition", ""))
        self.assertEqual("application/zip", folder_download.mimetype)
        with zipfile.ZipFile(io.BytesIO(folder_download.data), "r") as archive:
            names = set(archive.namelist())
            self.assertIn("Docs/note.txt", names)
            self.assertIn("Docs/Empty/", names)
            self.assertEqual(b"docs-content", archive.read("Docs/note.txt"))
        folder_download.close()

        multi_download = self.client.post(
            "/api/items/download",
            headers=headers,
            json={"item_ids": [docs_file_id, archive_file_id]},
        )
        self.assertEqual(200, multi_download.status_code)
        self.assertIn("filename=dataroom-download.zip", multi_download.headers.get("Content-Disposition", ""))
        with zipfile.ZipFile(io.BytesIO(multi_download.data), "r") as archive:
            names = set(archive.namelist())
            self.assertSetEqual({"note.txt", "note (1).txt"}, names)
            payloads = {archive.read(name) for name in names}
            self.assertSetEqual({b"docs-content", b"archive-content"}, payloads)
        multi_download.close()

        invalid_request = self.client.post("/api/items/download", headers=headers, json={"item_ids": []})
        self.assertEqual(400, invalid_request.status_code)
        self.assertEqual("invalid_request", invalid_request.json["error"]["code"])

    def test_bulk_move_is_atomic(self):
        headers = self._auth_headers("bulk-user")
        folder_a = self.client.post("/api/folders", headers=headers, json={"name": "FolderA"}).json["id"]
        folder_b = self.client.post("/api/folders", headers=headers, json={"name": "FolderB"}).json["id"]
        self.client.post("/api/folders", headers=headers, json={"parent_id": folder_a, "name": "doc1"})
        self.client.post("/api/folders", headers=headers, json={"parent_id": folder_a, "name": "doc2"})

        listing = self.client.get(f"/api/items?parent_id={folder_a}", headers=headers)
        ids = [item["id"] for item in listing.json["items"]]

        failed = self.client.post(
            "/api/items/bulk-move",
            headers=headers,
            json={"item_ids": [ids[0], "missing-item"], "target_folder_id": folder_b},
        )
        self.assertEqual(404, failed.status_code)

        source_after = self.client.get(f"/api/items?parent_id={folder_a}", headers=headers)
        self.assertEqual(2, len(source_after.json["items"]))

    def test_user_cannot_access_other_user_item(self):
        owner_headers = self._auth_headers("owner")
        intruder_headers = self._auth_headers("intruder")

        created = self.client.post("/api/folders", headers=owner_headers, json={"name": "Secret"})
        item_id = created.json["id"]

        forbidden_get = self.client.get(f"/api/items/{item_id}", headers=intruder_headers)
        self.assertEqual(404, forbidden_get.status_code)

        forbidden_delete = self.client.delete(f"/api/items/{item_id}", headers=intruder_headers)
        self.assertEqual(404, forbidden_delete.status_code)

    def test_google_files_returns_reconnect_required_on_token_failure(self):
        self._create_active_google_connection("reconnect-user", expired=True)

        with patch("app.services.google_drive_service.GoogleDriveService.list_files") as list_files_mock:
            list_files_mock.side_effect = ApiError(401, "google_reconnect_required", "Reconnect required")
            response = self.client.get("/api/integrations/google/files", headers=self._auth_headers("reconnect-user"))

        self.assertEqual(401, response.status_code)
        self.assertEqual("google_reconnect_required", response.json["error"]["code"])


if __name__ == "__main__":
    unittest.main()
