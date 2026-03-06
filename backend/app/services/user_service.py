from __future__ import annotations

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import User
from app.repositories import UserRepository


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.users = UserRepository(db)

    def find_or_create_from_firebase_claims(self, claims: dict) -> User:
        firebase_uid = claims.get("uid") or claims.get("sub")
        if not firebase_uid:
            raise ApiError(401, "unauthorized", "Firebase token does not contain uid.")

        user = self.users.get_by_firebase_uid(firebase_uid)
        email = claims.get("email")
        display_name = claims.get("name")
        photo_url = claims.get("picture")

        if user is None:
            user = User(
                firebase_uid=firebase_uid,
                email=email,
                display_name=display_name,
                photo_url=photo_url,
            )
            self.users.save(user)
            self.db.commit()
            self.db.refresh(user)
            return user

        changed = False
        if user.email != email:
            user.email = email
            changed = True
        if user.display_name != display_name:
            user.display_name = display_name
            changed = True
        if user.photo_url != photo_url:
            user.photo_url = photo_url
            changed = True

        if changed:
            self.users.save(user)
            self.db.commit()
            self.db.refresh(user)

        return user
