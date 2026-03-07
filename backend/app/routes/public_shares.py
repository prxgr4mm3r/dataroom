from __future__ import annotations

from pathlib import Path

from flask import Blueprint, current_app, g, jsonify, request, send_file

from app.services import ShareService

bp = Blueprint("public_shares", __name__, url_prefix="/api/public/shares")


def _build_service() -> ShareService:
    return ShareService(g.db, current_app.config)


def _is_inline_previewable(mime_type: str | None) -> bool:
    if not mime_type:
        return False
    return mime_type.startswith("text/") or mime_type.startswith("image/") or mime_type in {"application/pdf"}


@bp.get("/<raw_token>/meta")
def get_share_meta(raw_token: str):
    service = _build_service()
    response = service.get_meta(raw_token)
    g.db.commit()
    return jsonify(response)


@bp.get("/<raw_token>/items")
def list_shared_items(raw_token: str):
    parent_id = request.args.get("parent_id")
    sort_by = request.args.get("sort_by", "name")
    sort_order = request.args.get("sort_order", "asc")
    service = _build_service()
    response = service.list_items(raw_token, parent_id, sort_by, sort_order)
    g.db.commit()
    return jsonify(response)


@bp.get("/<raw_token>/folders/tree")
def get_shared_tree(raw_token: str):
    service = _build_service()
    response = service.get_folder_tree(raw_token)
    g.db.commit()
    return jsonify(response)


@bp.get("/<raw_token>/items/<item_id>")
def get_shared_item(raw_token: str, item_id: str):
    service = _build_service()
    response = service.resolve_item(raw_token, item_id)
    g.db.commit()
    return jsonify(response)


@bp.get("/<raw_token>/items/<item_id>/content")
def get_shared_content(raw_token: str, item_id: str):
    service = _build_service()
    item, asset = service.resolve_content(raw_token, item_id)
    g.db.commit()
    return send_file(
        asset.storage_path,
        mimetype=asset.mime_type,
        as_attachment=not _is_inline_previewable(asset.mime_type),
        download_name=item.name,
        conditional=True,
        max_age=0,
    )


@bp.post("/<raw_token>/download")
def download_shared_items(raw_token: str):
    payload = request.get_json(silent=True) or {}
    item_ids = payload.get("item_ids") or []

    service = _build_service()
    download = service.prepare_download(raw_token, item_ids)
    g.db.commit()

    response = send_file(
        download.file_path,
        mimetype=download.mime_type,
        as_attachment=True,
        download_name=download.download_name,
        conditional=True,
        max_age=0,
    )
    if download.temporary:
        response.call_on_close(lambda file_path=download.file_path: Path(file_path).unlink(missing_ok=True))
    return response
