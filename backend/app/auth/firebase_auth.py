from __future__ import annotations

import json
from pathlib import Path

from flask import current_app

from app.errors import ApiError


class FirebaseAuthService:
    def verify_id_token(self, token: str) -> dict:
        if not token:
            raise ApiError(401, "unauthorized", "Missing Firebase ID token.")

        if current_app.config.get("TESTING") and current_app.config.get("ALLOW_INSECURE_TEST_TOKENS"):
            return self._parse_test_token(token)

        auth = self._get_auth_module()

        try:
            return auth.verify_id_token(token, check_revoked=False)
        except Exception as exc:  # noqa: BLE001
            name = exc.__class__.__name__
            if name in {
                "InvalidIdTokenError",
                "ExpiredIdTokenError",
                "RevokedIdTokenError",
                "CertificateFetchError",
                "UserDisabledError",
            }:
                raise ApiError(401, "unauthorized", "Invalid Firebase ID token.") from exc
            raise ApiError(401, "unauthorized", "Firebase ID token verification failed.") from exc

    def generate_sign_in_link(self, email: str, continue_url: str) -> str:
        auth = self._get_auth_module()
        try:
            settings = auth.ActionCodeSettings(url=continue_url, handle_code_in_app=True)
            return auth.generate_sign_in_with_email_link(email, settings)
        except Exception as exc:  # noqa: BLE001
            raise ApiError(
                500,
                "magic_link_generation_failed",
                "Failed to generate magic link.",
            ) from exc

    def _get_auth_module(self):
        try:
            import firebase_admin
            from firebase_admin import auth
        except ImportError as exc:
            raise ApiError(
                500,
                "firebase_sdk_missing",
                "firebase-admin package is required for Firebase operations.",
            ) from exc

        if not firebase_admin._apps:
            project_id = current_app.config.get("FIREBASE_PROJECT_ID") or None
            credentials_json = current_app.config.get("FIREBASE_CREDENTIALS_JSON") or ""

            if credentials_json.strip():
                parsed = self._parse_credentials(credentials_json)
                firebase_admin.initialize_app(parsed, options={"projectId": project_id} if project_id else None)
            else:
                firebase_admin.initialize_app(options={"projectId": project_id} if project_id else None)

        return auth

    @staticmethod
    def _parse_credentials(raw_value: str):
        from firebase_admin import credentials

        possible_path = Path(raw_value)
        if possible_path.exists():
            return credentials.Certificate(str(possible_path))

        try:
            payload = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise ApiError(
                500,
                "firebase_credentials_invalid",
                "FIREBASE_CREDENTIALS_JSON must be valid JSON or path to credentials file.",
            ) from exc

        return credentials.Certificate(payload)

    @staticmethod
    def _parse_test_token(token: str) -> dict:
        prefix = "test-token:"
        if not token.startswith(prefix):
            raise ApiError(401, "unauthorized", "Invalid test token format.")

        parts = token[len(prefix) :].split(":")
        uid = parts[0] if len(parts) >= 1 and parts[0] else None
        email = parts[1] if len(parts) >= 2 and parts[1] else None
        name = parts[2] if len(parts) >= 3 and parts[2] else None

        if not uid:
            raise ApiError(401, "unauthorized", "Invalid test token uid.")

        return {
            "uid": uid,
            "sub": uid,
            "email": email,
            "name": name,
        }
