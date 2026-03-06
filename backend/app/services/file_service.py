from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import DataFile, FileStatus, User
from app.repositories import FileRepository, GoogleConnectionRepository
from app.services.file_storage_service import FileStorageService
from app.services.google_drive_service import GoogleDriveService


class FileService:
    def __init__(
        self,
        db: Session,
        config: dict,
        drive_service: GoogleDriveService,
        storage_service: FileStorageService,
    ):
        self.db = db
        self.config = config
        self.drive_service = drive_service
        self.storage_service = storage_service
        self.files = FileRepository(db)
        self.connections = GoogleConnectionRepository(db)

    def list_files(self, user_id: str) -> list[DataFile]:
        return self.files.list_for_user(user_id)

    def get_file(self, user_id: str, file_id: str) -> DataFile:
        data_file = self.files.get_for_user(user_id, file_id)
        if data_file is None:
            raise ApiError(404, "file_not_found", "File not found.")
        return data_file

    def import_from_google(self, user: User, google_file_id: str) -> DataFile:
        connection = self.connections.get_active_for_user(user.id)
        if connection is None:
            raise ApiError(400, "google_not_connected", "Google Drive is not connected.")

        existing = self.files.get_by_google_file_id(user.id, google_file_id)
        if existing is not None:
            raise ApiError(409, "file_already_imported", "Google Drive file is already imported.")

        metadata = self.drive_service.get_file_metadata(self.db, connection, google_file_id)
        mime_type = metadata.get("mimeType")
        if isinstance(mime_type, str) and mime_type.startswith("application/vnd.google-apps"):
            raise ApiError(
                400,
                "google_native_file_unsupported",
                "Google native files are not supported in MVP import.",
            )

        size_bytes = int(metadata["size"]) if metadata.get("size") else None
        max_size = int(self.config["MAX_IMPORT_FILE_SIZE_BYTES"])
        if size_bytes is not None and size_bytes > max_size:
            raise ApiError(413, "file_too_large", "Selected file exceeds size limit.")

        data_file = DataFile(
            user_id=user.id,
            google_connection_id=connection.id,
            source="google_drive",
            google_file_id=google_file_id,
            name=metadata.get("name") or google_file_id,
            mime_type=mime_type,
            size_bytes=size_bytes,
            status=FileStatus.FAILED.value,
        )
        self.files.save(data_file)

        saved_path: str | None = None
        try:
            response = self.drive_service.download_file_stream(self.db, connection, google_file_id)
            saved_path, actual_size, checksum = self.storage_service.save_stream(
                user.id,
                data_file.id,
                data_file.name,
                response.iter_content(chunk_size=64 * 1024),
            )
            data_file.local_path = saved_path
            data_file.size_bytes = actual_size
            data_file.checksum_sha256 = checksum
            data_file.status = FileStatus.READY.value
            data_file.imported_at = datetime.now(timezone.utc)

            self.db.add(data_file)
            self.db.commit()
            self.db.refresh(data_file)
            return data_file
        except Exception:  # noqa: BLE001
            self.db.rollback()
            if saved_path:
                self.storage_service.delete_file(saved_path)
            raise

    def delete_file(self, user_id: str, file_id: str) -> DataFile:
        data_file = self.files.get_for_user(user_id, file_id)
        if data_file is None:
            raise ApiError(404, "file_not_found", "File not found.")

        self.storage_service.delete_file(data_file.local_path)
        data_file.local_path = None
        data_file.status = FileStatus.DELETED.value
        data_file.updated_at = datetime.now(timezone.utc)

        self.db.add(data_file)
        self.db.commit()
        self.db.refresh(data_file)
        return data_file

    def resolve_content_path(self, user_id: str, file_id: str) -> DataFile:
        data_file = self.get_file(user_id, file_id)
        if not data_file.local_path:
            raise ApiError(410, "file_content_missing", "File content is no longer available.")

        if not Path(data_file.local_path).exists():
            raise ApiError(410, "file_content_missing", "File content is no longer available.")

        return data_file
