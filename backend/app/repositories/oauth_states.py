from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import OAuthState


class OAuthStateRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, state: OAuthState) -> OAuthState:
        self.db.add(state)
        self.db.flush()
        return state

    def consume(self, state_value: str, provider: str) -> OAuthState:
        oauth_state = (
            self.db.query(OAuthState)
            .filter(OAuthState.state == state_value, OAuthState.provider == provider)
            .one_or_none()
        )

        if oauth_state is None:
            raise ApiError(400, "invalid_oauth_state", "OAuth state is invalid.")

        if oauth_state.used_at is not None:
            raise ApiError(400, "oauth_state_already_used", "OAuth state is already used.")

        expires_at = oauth_state.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < datetime.now(timezone.utc):
            raise ApiError(400, "oauth_state_expired", "OAuth state is expired.")

        oauth_state.used_at = datetime.now(timezone.utc)
        self.db.add(oauth_state)
        self.db.flush()
        return oauth_state
