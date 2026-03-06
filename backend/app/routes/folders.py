from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import require_auth
from app.services import FileStorageService, FolderService, GoogleDriveService, TokenCipher

bp = Blueprint("folders", __name__, url_prefix="/api/folders")


def _build_folder_service() -> FolderService:
    token_cipher = TokenCipher(current_app.config["TOKEN_ENCRYPTION_KEY"])
    drive_service = GoogleDriveService(current_app.config, token_cipher)
    storage_service = FileStorageService(current_app.config["UPLOAD_DIR"])
    return FolderService.from_dependencies(g.db, current_app.config, drive_service, storage_service)


@bp.get("/tree")
@require_auth
def get_tree():
    service = _build_folder_service()
    return jsonify(service.get_tree(g.current_user.id))


@bp.post("")
@require_auth
def create_folder():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    parent_id = payload.get("parent_id")

    service = _build_folder_service()
    resource = service.create(g.current_user.id, parent_id, name)
    g.db.commit()
    return jsonify(resource), 201
