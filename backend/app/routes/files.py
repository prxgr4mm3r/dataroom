from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request, send_file

from app.auth import require_auth
from app.services import FileService, FileStorageService, GoogleDriveService, TokenCipher

bp = Blueprint("files", __name__, url_prefix="/api/files")


def _build_file_service() -> FileService:
    token_cipher = TokenCipher(current_app.config["TOKEN_ENCRYPTION_KEY"])
    drive_service = GoogleDriveService(current_app.config, token_cipher)
    storage_service = FileStorageService(current_app.config["UPLOAD_DIR"])
    return FileService(g.db, current_app.config, drive_service, storage_service)


def _serialize_file(data_file) -> dict:
    return {
        "id": data_file.id,
        "name": data_file.name,
        "mime_type": data_file.mime_type,
        "size_bytes": data_file.size_bytes,
        "status": data_file.status,
        "imported_at": data_file.imported_at.isoformat() if data_file.imported_at else None,
        "google_file_id": data_file.google_file_id,
    }


def _is_inline_previewable(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    return (
        mime_type.startswith("text/")
        or mime_type.startswith("image/")
        or mime_type in {"application/pdf"}
    )


@bp.get("")
@require_auth
def list_files():
    service = _build_file_service()
    files = service.list_files(g.current_user.id)
    return jsonify({"files": [_serialize_file(f) for f in files]})


@bp.get("/<file_id>")
@require_auth
def get_file(file_id: str):
    service = _build_file_service()
    data_file = service.get_file(g.current_user.id, file_id)
    return jsonify(_serialize_file(data_file))


@bp.get("/<file_id>/content")
@require_auth
def get_file_content(file_id: str):
    service = _build_file_service()
    data_file = service.resolve_content_path(g.current_user.id, file_id)
    return send_file(
        data_file.local_path,
        mimetype=data_file.mime_type,
        as_attachment=not _is_inline_previewable(data_file.mime_type),
        download_name=data_file.name,
        conditional=True,
        max_age=0,
    )


@bp.post("/import-from-google")
@require_auth
def import_from_google():
    payload = request.get_json(silent=True) or {}
    google_file_id = str(payload.get("google_file_id", "")).strip()
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

    service = _build_file_service()
    imported = service.import_from_google(g.current_user, google_file_id)
    return jsonify(_serialize_file(imported)), 201


@bp.delete("/<file_id>")
@require_auth
def delete_file(file_id: str):
    service = _build_file_service()
    data_file = service.delete_file(g.current_user.id, file_id)
    return jsonify({"id": data_file.id, "status": data_file.status})
