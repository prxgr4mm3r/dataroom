from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import GoogleDriveConnection
from app.services.token_cipher import TokenCipher


class GoogleDriveService:
    def __init__(self, config: dict, token_cipher: TokenCipher):
        self.config = config
        self.token_cipher = token_cipher

    def list_files(
        self,
        db: Session,
        connection: GoogleDriveConnection,
        page_size: int = 100,
        page_token: str | None = None,
        query: str | None = None,
        source: str = "recent",
        order_by: str | None = None,
    ) -> dict[str, Any]:
        drive_query = "trashed=false and mimeType != 'application/vnd.google-apps.folder'"
        if source == "my_drive":
            drive_query = f"{drive_query} and 'me' in owners"
        elif source == "shared":
            drive_query = f"{drive_query} and sharedWithMe=true"

        if query:
            safe_query = query.replace("'", "\\'")
            drive_query = f"{drive_query} and name contains '{safe_query}'"

        default_order_by = {
            "recent": "modifiedTime desc",
            "my_drive": "name_natural",
            "shared": "modifiedTime desc",
        }
        resolved_order_by = order_by or default_order_by.get(source, "modifiedTime desc")

        params = {
            "fields": "files(id,name,mimeType,size,quotaBytesUsed,modifiedTime,webViewLink,thumbnailLink,iconLink,shared,owners(displayName,emailAddress,me)),nextPageToken",
            "pageSize": max(1, min(int(page_size), 200)),
            "q": drive_query,
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
            "orderBy": resolved_order_by,
        }
        if page_token:
            params["pageToken"] = page_token

        response = self._request_with_retry(
            db,
            connection,
            "GET",
            self.config["GOOGLE_DRIVE_FILES_URL"],
            params=params,
        )
        if not response.ok:
            raise ApiError(502, "google_drive_api_error", self._extract_google_error(response))

        files = []
        payload = response.json()
        for item in payload.get("files", []):
            size_value = item.get("size") or item.get("quotaBytesUsed")
            owners = item.get("owners") if isinstance(item.get("owners"), list) else []
            owner = owners[0] if owners else {}
            files.append(
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "mime_type": item.get("mimeType"),
                    "size_bytes": int(size_value) if size_value not in (None, "") else None,
                    "modified_at": item.get("modifiedTime"),
                    "web_view_link": item.get("webViewLink"),
                    "thumbnail_url": item.get("thumbnailLink"),
                    "icon_url": item.get("iconLink"),
                    "shared": bool(item.get("shared")),
                    "owner_name": owner.get("displayName") if isinstance(owner, dict) else None,
                    "owner_email": owner.get("emailAddress") if isinstance(owner, dict) else None,
                }
            )
        return {
            "files": files,
            "next_page_token": payload.get("nextPageToken"),
        }

    def get_file_metadata(self, db: Session, connection: GoogleDriveConnection, google_file_id: str) -> dict[str, Any]:
        response = self._request_with_retry(
            db,
            connection,
            "GET",
            f"{self.config['GOOGLE_DRIVE_FILES_URL']}/{google_file_id}",
            params={
                "fields": "id,name,mimeType,size,md5Checksum,modifiedTime",
                "supportsAllDrives": "true",
            },
        )
        if response.status_code == 404:
            raise ApiError(404, "google_file_not_found", "Google Drive file not found.")
        if not response.ok:
            raise ApiError(502, "google_drive_api_error", self._extract_google_error(response))
        return response.json()

    def download_file_stream(self, db: Session, connection: GoogleDriveConnection, google_file_id: str) -> requests.Response:
        response = self._request_with_retry(
            db,
            connection,
            "GET",
            f"{self.config['GOOGLE_DRIVE_FILES_URL']}/{google_file_id}",
            params={"alt": "media", "supportsAllDrives": "true"},
            stream=True,
        )
        if response.status_code == 404:
            raise ApiError(404, "google_file_not_found", "Google Drive file not found.")
        if response.status_code == 403:
            raise ApiError(403, "google_file_access_denied", "Access denied to Google Drive file.")
        if not response.ok:
            raise ApiError(502, "google_drive_download_failed", self._extract_google_error(response))
        return response

    def ensure_valid_access_token(self, db: Session, connection: GoogleDriveConnection) -> str:
        now = datetime.now(timezone.utc)
        expiry_at = connection.token_expiry_at
        if expiry_at is not None and expiry_at.tzinfo is None:
            expiry_at = expiry_at.replace(tzinfo=timezone.utc)

        if expiry_at is None or expiry_at <= now + timedelta(seconds=30):
            return self.refresh_access_token(db, connection)

        if not connection.access_token_encrypted:
            return self.refresh_access_token(db, connection)

        return self.token_cipher.decrypt(connection.access_token_encrypted)

    def refresh_access_token(self, db: Session, connection: GoogleDriveConnection) -> str:
        if not connection.refresh_token_encrypted:
            raise ApiError(401, "google_reconnect_required", "Google refresh token is missing.")

        refresh_token = self.token_cipher.decrypt(connection.refresh_token_encrypted)
        payload = {
            "client_id": self.config["GOOGLE_CLIENT_ID"],
            "client_secret": self.config["GOOGLE_CLIENT_SECRET"],
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        response = requests.post(
            self.config["GOOGLE_TOKEN_URL"],
            data=payload,
            timeout=self.config["REQUEST_TIMEOUT_SECONDS"],
        )

        if not response.ok:
            connection.is_active = False
            db.add(connection)
            db.flush()
            raise ApiError(401, "google_reconnect_required", "Google token refresh failed.")

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ApiError(401, "google_reconnect_required", "Google token refresh did not return access token.")

        connection.access_token_encrypted = self.token_cipher.encrypt(access_token)
        if token_data.get("refresh_token"):
            connection.refresh_token_encrypted = self.token_cipher.encrypt(token_data["refresh_token"])
        if token_data.get("scope"):
            connection.scope = token_data["scope"]

        expires_in = int(token_data.get("expires_in", 3600))
        connection.token_expiry_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        db.add(connection)
        db.flush()
        return access_token

    def _request_with_retry(
        self,
        db: Session,
        connection: GoogleDriveConnection,
        method: str,
        url: str,
        **kwargs: Any,
    ) -> requests.Response:
        access_token = self.ensure_valid_access_token(db, connection)
        headers = kwargs.pop("headers", {})
        headers = {**headers, "Authorization": f"Bearer {access_token}"}

        response = requests.request(
            method,
            url,
            headers=headers,
            timeout=self.config["REQUEST_TIMEOUT_SECONDS"],
            **kwargs,
        )
        if response.status_code != 401:
            return response

        refreshed_token = self.refresh_access_token(db, connection)
        retry_headers = {**headers, "Authorization": f"Bearer {refreshed_token}"}
        return requests.request(
            method,
            url,
            headers=retry_headers,
            timeout=self.config["REQUEST_TIMEOUT_SECONDS"],
            **kwargs,
        )

    @staticmethod
    def _extract_google_error(response: requests.Response) -> str:
        try:
            payload = response.json()
        except Exception:  # noqa: BLE001
            return f"Google Drive request failed with status {response.status_code}."

        error = payload.get("error")
        if isinstance(error, dict):
            return error.get("message") or str(error)
        if isinstance(error, str):
            return error
        return f"Google Drive request failed with status {response.status_code}."
