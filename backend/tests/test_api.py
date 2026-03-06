from __future__ import annotations

import tempfile
import unittest
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

    def test_me_with_valid_test_token(self):
        response = self.client.get("/api/me", headers=self._auth_headers("user-main"))
        self.assertEqual(200, response.status_code)
        self.assertEqual("user-main", response.json["firebase_uid"])

    def test_google_connect_returns_auth_url(self):
        response = self.client.post("/api/integrations/google/connect", headers=self._auth_headers("connect-user"))
        self.assertEqual(200, response.status_code)
        self.assertIn("accounts.google.com", response.json["auth_url"])
        self.assertIn("state=", response.json["auth_url"])

    def test_google_callback_invalid_state_redirects_with_error(self):
        response = self.client.get("/api/integrations/google/callback?code=test-code&state=invalid")
        self.assertEqual(302, response.status_code)
        location = response.headers["Location"]
        self.assertIn("status=error", location)
        self.assertIn("invalid_oauth_state", location)

    def test_google_files_requires_connected_account(self):
        response = self.client.get("/api/integrations/google/files", headers=self._auth_headers("no-conn"))
        self.assertEqual(400, response.status_code)
        self.assertEqual("google_not_connected", response.json["error"]["code"])

    def test_google_files_returns_reconnect_required_on_token_failure(self):
        self._create_active_google_connection("reconnect-user", expired=True)

        with patch("app.services.google_drive_service.GoogleDriveService.list_files") as list_files_mock:
            list_files_mock.side_effect = ApiError(401, "google_reconnect_required", "Reconnect required")
            response = self.client.get("/api/integrations/google/files", headers=self._auth_headers("reconnect-user"))

        self.assertEqual(401, response.status_code)
        self.assertEqual("google_reconnect_required", response.json["error"]["code"])

    def test_import_preview_soft_delete_flow(self):
        self._create_active_google_connection("import-user")

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
            import_response = self.client.post(
                "/api/files/import-from-google",
                headers=self._auth_headers("import-user"),
                json={"google_file_id": "google-file-1"},
            )

        self.assertEqual(201, import_response.status_code)
        imported_id = import_response.json["id"]

        list_response = self.client.get("/api/files", headers=self._auth_headers("import-user"))
        self.assertEqual(200, list_response.status_code)
        self.assertEqual(1, len(list_response.json["files"]))

        content_response = self.client.get(
            f"/api/files/{imported_id}/content",
            headers=self._auth_headers("import-user"),
        )
        self.assertEqual(200, content_response.status_code)
        self.assertIn(b"hello world", content_response.data)
        content_response.close()

        delete_response = self.client.delete(
            f"/api/files/{imported_id}",
            headers=self._auth_headers("import-user"),
        )
        self.assertEqual(200, delete_response.status_code)
        self.assertEqual("deleted", delete_response.json["status"])

        second_delete = self.client.delete(
            f"/api/files/{imported_id}",
            headers=self._auth_headers("import-user"),
        )
        self.assertEqual(404, second_delete.status_code)

    def test_user_cannot_delete_other_user_file(self):
        self._create_active_google_connection("owner")

        with (
            patch(
                "app.services.google_drive_service.GoogleDriveService.get_file_metadata",
                return_value={
                    "id": "google-file-2",
                    "name": "secret.txt",
                    "mimeType": "text/plain",
                    "size": "5",
                },
            ),
            patch(
                "app.services.google_drive_service.GoogleDriveService.download_file_stream",
                return_value=FakeGoogleDownloadResponse(b"12345"),
            ),
        ):
            import_response = self.client.post(
                "/api/files/import-from-google",
                headers=self._auth_headers("owner"),
                json={"google_file_id": "google-file-2"},
            )

        file_id = import_response.json["id"]
        forbidden_delete = self.client.delete(
            f"/api/files/{file_id}",
            headers=self._auth_headers("intruder"),
        )
        self.assertEqual(404, forbidden_delete.status_code)


if __name__ == "__main__":
    unittest.main()
