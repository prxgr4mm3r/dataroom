from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import GoogleDriveConnection, User
from app.repositories import GoogleConnectionRepository
from app.services.token_cipher import TokenCipher


class GoogleOAuthService:
    def __init__(self, config: dict, token_cipher: TokenCipher):
        self.config = config
        self.token_cipher = token_cipher

    def build_authorization_url(self, state: str) -> str:
        if not self.config.get("GOOGLE_CLIENT_ID"):
            raise ApiError(500, "google_oauth_not_configured", "GOOGLE_CLIENT_ID is not configured.")

        params = {
            "client_id": self.config["GOOGLE_CLIENT_ID"],
            "redirect_uri": self.config["GOOGLE_REDIRECT_URI"],
            "response_type": "code",
            "scope": " ".join(self.config["GOOGLE_SCOPES"]),
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
        return f"{self.config['GOOGLE_OAUTH_AUTH_URL']}?{urlencode(params)}"

    def exchange_code_for_tokens(self, code: str) -> dict:
        payload = {
            "code": code,
            "client_id": self.config["GOOGLE_CLIENT_ID"],
            "client_secret": self.config["GOOGLE_CLIENT_SECRET"],
            "redirect_uri": self.config["GOOGLE_REDIRECT_URI"],
            "grant_type": "authorization_code",
        }
        response = requests.post(
            self.config["GOOGLE_TOKEN_URL"],
            data=payload,
            timeout=self.config["REQUEST_TIMEOUT_SECONDS"],
        )
        if not response.ok:
            raise ApiError(400, "google_code_exchange_failed", self._extract_google_error(response))

        token_data = response.json()
        if "access_token" not in token_data:
            raise ApiError(400, "google_code_exchange_failed", "Google did not return access_token.")
        return token_data

    def fetch_google_profile(self, access_token: str) -> dict:
        response = requests.get(
            self.config["GOOGLE_USERINFO_URL"],
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=self.config["REQUEST_TIMEOUT_SECONDS"],
        )
        if not response.ok:
            raise ApiError(400, "google_profile_fetch_failed", self._extract_google_error(response))

        profile = response.json()
        if "sub" not in profile:
            raise ApiError(400, "google_profile_fetch_failed", "Google profile does not include sub.")
        return profile

    def upsert_connection(self, db: Session, user: User, token_data: dict, profile: dict) -> GoogleDriveConnection:
        repo = GoogleConnectionRepository(db)
        google_sub = profile["sub"]
        existing = repo.get_by_google_sub(google_sub)

        if existing is not None and existing.user_id != user.id:
            raise ApiError(409, "google_account_already_linked", "Google account is linked to another user.")

        repo.deactivate_all_for_user(user.id)

        connection = existing or GoogleDriveConnection(
            user_id=user.id,
            google_sub=google_sub,
        )

        refresh_token = token_data.get("refresh_token")
        if not refresh_token and connection.refresh_token_encrypted:
            refresh_token = self.token_cipher.decrypt(connection.refresh_token_encrypted)
        if not refresh_token:
            raise ApiError(
                400,
                "google_refresh_token_missing",
                "Google did not return refresh token. Reconnect with consent prompt.",
            )

        access_token = token_data["access_token"]
        expires_in = int(token_data.get("expires_in", 3600))

        connection.user_id = user.id
        connection.google_email = profile.get("email")
        connection.access_token_encrypted = self.token_cipher.encrypt(access_token)
        connection.refresh_token_encrypted = self.token_cipher.encrypt(refresh_token)
        connection.token_expiry_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        connection.scope = token_data.get("scope", connection.scope)
        connection.is_active = True

        repo.save(connection)
        return connection

    @staticmethod
    def _extract_google_error(response: requests.Response) -> str:
        try:
            payload = response.json()
        except Exception:  # noqa: BLE001
            return f"Google API request failed with status {response.status_code}."

        error = payload.get("error")
        if isinstance(error, dict):
            return error.get("message") or str(error)
        if isinstance(error, str):
            return error
        return f"Google API request failed with status {response.status_code}."
