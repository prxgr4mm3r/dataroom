from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import DataFile, FileStatus


class FileRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_for_user(self, user_id: str) -> list[DataFile]:
        return (
            self.db.query(DataFile)
            .filter(
                DataFile.user_id == user_id,
                DataFile.status != FileStatus.DELETED.value,
            )
            .order_by(DataFile.imported_at.desc(), DataFile.created_at.desc())
            .all()
        )

    def get_for_user(self, user_id: str, file_id: str, include_deleted: bool = False) -> DataFile | None:
        query = self.db.query(DataFile).filter(DataFile.user_id == user_id, DataFile.id == file_id)
        if not include_deleted:
            query = query.filter(DataFile.status != FileStatus.DELETED.value)
        return query.one_or_none()

    def get_by_google_file_id(self, user_id: str, google_file_id: str) -> DataFile | None:
        return (
            self.db.query(DataFile)
            .filter(
                DataFile.user_id == user_id,
                DataFile.google_file_id == google_file_id,
            )
            .one_or_none()
        )

    def save(self, data_file: DataFile) -> DataFile:
        self.db.add(data_file)
        self.db.flush()
        return data_file
