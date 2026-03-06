from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import require_auth
from app.services import FileStorageService, GoogleDriveService, ItemService, TokenCipher

bp = Blueprint("files", __name__, url_prefix="/api/files")


def _build_item_service() -> ItemService:
    token_cipher = TokenCipher(current_app.config["TOKEN_ENCRYPTION_KEY"])
    drive_service = GoogleDriveService(current_app.config, token_cipher)
    storage_service = FileStorageService(current_app.config["UPLOAD_DIR"])
    return ItemService(g.db, current_app.config, drive_service, storage_service)


@bp.post("/import-from-google")
@require_auth
def import_from_google():
    payload = request.get_json(silent=True) or {}
    google_file_id = str(payload.get("google_file_id", "")).strip()
    target_folder_id = payload.get("target_folder_id")
    if not google_file_id:
        return (
            jsonify(
                {
                    "error": {
                        "code": "invalid_request",
                        "message": "google_file_id is required.",
                    }
                }
            ),
            400,
        )

    service = _build_item_service()
    imported = service.import_from_google(g.current_user, google_file_id, target_folder_id)
    g.db.commit()
    return jsonify(imported), 201


@bp.post("/upload")
@require_auth
def upload_file():
    uploaded = request.files.get("file")
    target_folder_id = request.form.get("target_folder_id")

    service = _build_item_service()
    created = service.upload_local_file(g.current_user.id, uploaded, target_folder_id)
    g.db.commit()
    return jsonify(created), 201
