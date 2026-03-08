from __future__ import annotations

import os
from pathlib import Path
from typing import Any


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_int(value: str | None, default: int) -> int:
    if value is None or value.strip() == "":
        return default
    return int(value)


def build_config(overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    base_dir = Path(__file__).resolve().parents[1]
    upload_dir = Path(os.getenv("UPLOAD_DIR", "storage/uploads"))
    if not upload_dir.is_absolute():
        upload_dir = base_dir / upload_dir

    config: dict[str, Any] = {
        "SECRET_KEY": os.getenv("SECRET_KEY", "change-me"),
        "FLASK_ENV": os.getenv("FLASK_ENV", "development"),
        "DATABASE_URL": os.getenv("DATABASE_URL", "sqlite:///app.db"),
        "FRONTEND_URL": os.getenv("FRONTEND_URL", "http://localhost:5173"),
        "UPLOAD_DIR": str(upload_dir),
        "GOOGLE_CLIENT_ID": os.getenv("GOOGLE_CLIENT_ID", ""),
        "GOOGLE_CLIENT_SECRET": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "GOOGLE_REDIRECT_URI": os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:5000/api/integrations/google/callback",
        ),
        "GOOGLE_SCOPES": [
            "https://www.googleapis.com/auth/drive.readonly",
            "openid",
            "email",
            "profile",
        ],
        "GOOGLE_TOKEN_URL": "https://oauth2.googleapis.com/token",
        "GOOGLE_OAUTH_AUTH_URL": "https://accounts.google.com/o/oauth2/v2/auth",
        "GOOGLE_USERINFO_URL": "https://openidconnect.googleapis.com/v1/userinfo",
        "GOOGLE_DRIVE_FILES_URL": "https://www.googleapis.com/drive/v3/files",
        "OAUTH_STATE_TTL_SECONDS": _as_int(os.getenv("OAUTH_STATE_TTL_SECONDS"), 600),
        "TOKEN_ENCRYPTION_KEY": os.getenv("TOKEN_ENCRYPTION_KEY", "change-me-encryption-key"),
        "FIREBASE_PROJECT_ID": os.getenv("FIREBASE_PROJECT_ID", ""),
        "FIREBASE_CREDENTIALS_JSON": os.getenv("FIREBASE_CREDENTIALS_JSON", ""),
        "AUTH_MAGIC_LINK_CONTINUE_URL": os.getenv("AUTH_MAGIC_LINK_CONTINUE_URL", ""),
        "AUTH_MAGIC_LINK_SUBJECT": os.getenv("AUTH_MAGIC_LINK_SUBJECT", "Sign in to Dataroom.demo"),
        "MAIL_SMTP_HOST": os.getenv("MAIL_SMTP_HOST", ""),
        "MAIL_SMTP_PORT": _as_int(os.getenv("MAIL_SMTP_PORT"), 587),
        "MAIL_SMTP_USERNAME": os.getenv("MAIL_SMTP_USERNAME", ""),
        "MAIL_SMTP_PASSWORD": os.getenv("MAIL_SMTP_PASSWORD", ""),
        "MAIL_SMTP_USE_TLS": _as_bool(os.getenv("MAIL_SMTP_USE_TLS"), True),
        "MAIL_SMTP_USE_SSL": _as_bool(os.getenv("MAIL_SMTP_USE_SSL"), False),
        "MAIL_FROM_EMAIL": os.getenv("MAIL_FROM_EMAIL", ""),
        "MAIL_FROM_NAME": os.getenv("MAIL_FROM_NAME", "Dataroom.demo"),
        "MAIL_REPLY_TO": os.getenv("MAIL_REPLY_TO", ""),
        "ALLOW_INSECURE_TEST_TOKENS": _as_bool(os.getenv("ALLOW_INSECURE_TEST_TOKENS"), False),
        "AUTO_CREATE_SCHEMA": _as_bool(os.getenv("AUTO_CREATE_SCHEMA"), False),
        "MAX_IMPORT_FILE_SIZE_BYTES": _as_int(
            os.getenv("MAX_IMPORT_FILE_SIZE_BYTES"),
            4 * 1024 * 1024,
        ),
        "REQUEST_TIMEOUT_SECONDS": _as_int(os.getenv("REQUEST_TIMEOUT_SECONDS"), 20),
        "SHARE_TOKEN_PEPPER": os.getenv("SHARE_TOKEN_PEPPER", os.getenv("SECRET_KEY", "change-me")),
        "SHARE_TOKEN_KID_BYTES": _as_int(os.getenv("SHARE_TOKEN_KID_BYTES"), 9),
        "SHARE_TOKEN_SECRET_BYTES": _as_int(os.getenv("SHARE_TOKEN_SECRET_BYTES"), 32),
        "SHARE_DEFAULT_TTL_DAYS": _as_int(os.getenv("SHARE_DEFAULT_TTL_DAYS"), 30),
        "SHARE_MAX_TTL_DAYS": _as_int(os.getenv("SHARE_MAX_TTL_DAYS"), 365),
    }

    if overrides:
        config.update(overrides)

    return config
