from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request, send_file

from app.auth import require_auth
from app.services import BulkService, FileStorageService, GoogleDriveService, ItemService, TokenCipher

bp = Blueprint("items", __name__, url_prefix="/api/items")


def _build_item_service() -> ItemService:
    token_cipher = TokenCipher(current_app.config["TOKEN_ENCRYPTION_KEY"])
    drive_service = GoogleDriveService(current_app.config, token_cipher)
    storage_service = FileStorageService(current_app.config["UPLOAD_DIR"])
    return ItemService(g.db, current_app.config, drive_service, storage_service)


def _is_inline_previewable(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    return mime_type.startswith("text/") or mime_type.startswith("image/") or mime_type in {"application/pdf"}


@bp.get("")
@require_auth
def list_items():
    parent_id = request.args.get("parent_id")
    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")
    service = _build_item_service()
    response = service.list_items(g.current_user.id, parent_id, sort_by, sort_order)
    return jsonify(response)


@bp.get("/<item_id>")
@require_auth
def get_item(item_id: str):
    service = _build_item_service()
    return jsonify(service.get_item_resource(g.current_user.id, item_id))


@bp.get("/<item_id>/content")
@require_auth
def get_item_content(item_id: str):
    service = _build_item_service()
    item, asset = service.resolve_content(g.current_user.id, item_id)
    return send_file(
        asset.storage_path,
        mimetype=asset.mime_type,
        as_attachment=not _is_inline_previewable(asset.mime_type),
        download_name=item.name,
        conditional=True,
        max_age=0,
    )


@bp.patch("/<item_id>/move")
@require_auth
def move_item(item_id: str):
    payload = request.get_json(silent=True) or {}
    target_folder_id = payload.get("target_folder_id")
    service = _build_item_service()
    resource = service.move_item(g.current_user.id, item_id, target_folder_id)
    g.db.commit()
    return jsonify(resource)


@bp.post("/<item_id>/copy")
@require_auth
def copy_item(item_id: str):
    payload = request.get_json(silent=True) or {}
    target_folder_id = payload.get("target_folder_id")
    service = _build_item_service()
    resource = service.copy_item(g.current_user.id, item_id, target_folder_id)
    g.db.commit()
    return jsonify(resource), 201


@bp.delete("/<item_id>")
@require_auth
def delete_item(item_id: str):
    service = _build_item_service()
    response = service.delete_item(g.current_user.id, item_id)
    g.db.commit()
    return jsonify(response)


@bp.post("/bulk-move")
@require_auth
def bulk_move():
    payload = request.get_json(silent=True) or {}
    item_ids = payload.get("item_ids") or []
    target_folder_id = payload.get("target_folder_id")

    service = _build_item_service()
    bulk = BulkService(service)
    response = bulk.bulk_move(g.current_user.id, item_ids, target_folder_id)
    g.db.commit()
    return jsonify(response)


@bp.post("/bulk-copy")
@require_auth
def bulk_copy():
    payload = request.get_json(silent=True) or {}
    item_ids = payload.get("item_ids") or []
    target_folder_id = payload.get("target_folder_id")

    service = _build_item_service()
    bulk = BulkService(service)
    response = bulk.bulk_copy(g.current_user.id, item_ids, target_folder_id)
    g.db.commit()
    return jsonify(response), 201


@bp.post("/bulk-delete")
@require_auth
def bulk_delete():
    payload = request.get_json(silent=True) or {}
    item_ids = payload.get("item_ids") or []

    service = _build_item_service()
    bulk = BulkService(service)
    response = bulk.bulk_delete(g.current_user.id, item_ids)
    g.db.commit()
    return jsonify(response)
