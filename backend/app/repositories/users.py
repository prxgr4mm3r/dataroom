from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> User | None:
        return self.db.query(User).filter(User.id == user_id).one_or_none()

    def get_by_firebase_uid(self, firebase_uid: str) -> User | None:
        return self.db.query(User).filter(User.firebase_uid == firebase_uid).one_or_none()

    def save(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user
