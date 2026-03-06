from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from flask import Blueprint, current_app, g, jsonify, redirect, request

from app.auth import require_auth
from app.errors import ApiError
from app.models import OAuthState
from app.repositories import GoogleConnectionRepository, OAuthStateRepository, UserRepository
from app.services import GoogleDriveService, GoogleOAuthService, TokenCipher

bp = Blueprint("google_integration", __name__, url_prefix="/api/integrations/google")


def _service_bundle():
    cipher = TokenCipher(current_app.config["TOKEN_ENCRYPTION_KEY"])
    oauth_service = GoogleOAuthService(current_app.config, cipher)
    drive_service = GoogleDriveService(current_app.config, cipher)
    return oauth_service, drive_service


def _frontend_redirect(status: str, code: str | None = None) -> str:
    base = current_app.config["FRONTEND_URL"].rstrip("/")
    query = {
        "provider": "google",
        "status": status,
    }
    if code:
        query["code"] = code
    return f"{base}/oauth/callback?{urlencode(query)}"


@bp.get("/status")
@require_auth
def status():
    connection = GoogleConnectionRepository(g.db).get_active_for_user(g.current_user.id)
    if connection is None:
        return jsonify({"connected": False})

    now = datetime.now(timezone.utc)
    expiry_at = connection.token_expiry_at
    if expiry_at is not None and expiry_at.tzinfo is None:
        expiry_at = expiry_at.replace(tzinfo=timezone.utc)
    token_expired = expiry_at is None or expiry_at <= now
    return jsonify(
        {
            "connected": True,
            "google_email": connection.google_email,
            "token_expired": token_expired,
        }
    )


@bp.post("/connect")
@require_auth
def connect():
    oauth_service, _ = _service_bundle()
    state_value = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=current_app.config["OAUTH_STATE_TTL_SECONDS"]
    )

    state = OAuthState(
        user_id=g.current_user.id,
        provider="google_drive",
        state=state_value,
        expires_at=expires_at,
        used_at=None,
        created_at=datetime.now(timezone.utc),
    )
    OAuthStateRepository(g.db).create(state)
    g.db.commit()

    return jsonify({"auth_url": oauth_service.build_authorization_url(state_value)})


@bp.get("/callback")
def callback():
    db = g.db
    oauth_states = OAuthStateRepository(db)
    users = UserRepository(db)

    try:
        if request.args.get("error"):
            raise ApiError(400, "google_oauth_denied", request.args.get("error", "Google OAuth denied."))

        code = request.args.get("code", "").strip()
        state_value = request.args.get("state", "").strip()
        if not code or not state_value:
            raise ApiError(400, "invalid_oauth_callback", "Missing OAuth code or state.")

        oauth_state = oauth_states.consume(state_value, "google_drive")
        user = users.get_by_id(oauth_state.user_id)
        if user is None:
            raise ApiError(400, "invalid_oauth_state", "OAuth state references unknown user.")

        oauth_service, _ = _service_bundle()
        token_data = oauth_service.exchange_code_for_tokens(code)
        profile = oauth_service.fetch_google_profile(token_data["access_token"])
        oauth_service.upsert_connection(db, user, token_data, profile)

        db.commit()
        return redirect(_frontend_redirect("success"), code=302)
    except ApiError as error:
        db.rollback()
        return redirect(_frontend_redirect("error", error.code), code=302)


@bp.delete("/disconnect")
@require_auth
def disconnect():
    repo = GoogleConnectionRepository(g.db)
    connection = repo.get_active_for_user(g.current_user.id)
    if connection is None:
        return jsonify({"connected": False})

    connection.is_active = False
    connection.access_token_encrypted = None
    connection.refresh_token_encrypted = None
    connection.token_expiry_at = None
    connection.scope = None
    repo.save(connection)
    g.db.commit()

    return jsonify({"connected": False})


@bp.get("/files")
@require_auth
def google_files():
    repo = GoogleConnectionRepository(g.db)
    connection = repo.get_active_for_user(g.current_user.id)
    if connection is None:
        raise ApiError(400, "google_not_connected", "Google Drive is not connected.")

    _, drive_service = _service_bundle()
    files = drive_service.list_files(g.db, connection)
    g.db.commit()
    return jsonify({"files": files})
