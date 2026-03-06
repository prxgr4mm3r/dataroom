from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import GoogleDriveConnection


class GoogleConnectionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_for_user(self, user_id: str) -> GoogleDriveConnection | None:
        return (
            self.db.query(GoogleDriveConnection)
            .filter(
                GoogleDriveConnection.user_id == user_id,
                GoogleDriveConnection.is_active.is_(True),
            )
            .one_or_none()
        )

    def get_by_google_sub(self, google_sub: str) -> GoogleDriveConnection | None:
        return (
            self.db.query(GoogleDriveConnection)
            .filter(GoogleDriveConnection.google_sub == google_sub)
            .one_or_none()
        )

    def deactivate_all_for_user(self, user_id: str) -> None:
        (
            self.db.query(GoogleDriveConnection)
            .filter(
                GoogleDriveConnection.user_id == user_id,
                GoogleDriveConnection.is_active.is_(True),
            )
            .update({GoogleDriveConnection.is_active: False}, synchronize_session=False)
        )

    def save(self, connection: GoogleDriveConnection) -> GoogleDriveConnection:
        self.db.add(connection)
        self.db.flush()
        return connection
