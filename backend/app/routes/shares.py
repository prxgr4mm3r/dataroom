from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import require_auth
from app.errors import ApiError
from app.services import ShareService

bp = Blueprint("shares", __name__, url_prefix="/api/shares")


def _build_service() -> ShareService:
    return ShareService(g.db, current_app.config)


@bp.get("")
@require_auth
def list_shares():
    item_id = request.args.get("item_id")
    normalized_item_id = str(item_id).strip() if item_id else None
    include_revoked = str(request.args.get("include_revoked", "false")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    service = _build_service()
    response = service.list_links(
        owner_user_id=g.current_user.id,
        root_item_id=normalized_item_id,
        include_revoked=include_revoked,
    )
    return jsonify({"items": response})


@bp.post("")
@require_auth
def create_share():
    payload = request.get_json(silent=True) or {}
    item_id = str(payload.get("item_id", "")).strip()
    if not item_id:
        raise ApiError(400, "invalid_request", "item_id is required.")

    raw_ttl_days = payload.get("expires_in_days")
    expires_in_days: int | None
    if raw_ttl_days is None:
        expires_in_days = None
    else:
        try:
            expires_in_days = int(raw_ttl_days)
        except (TypeError, ValueError) as exc:
            raise ApiError(400, "invalid_request", "expires_in_days must be an integer.") from exc

    service = _build_service()
    response = service.create_readonly_link(
        owner_user_id=g.current_user.id,
        root_item_id=item_id,
        expires_in_days=expires_in_days,
    )
    g.db.commit()
    return jsonify(response), 201


@bp.delete("/<share_id>")
@require_auth
def revoke_share(share_id: str):
    service = _build_service()
    response = service.revoke_link(g.current_user.id, share_id)
    g.db.commit()
    return jsonify(response)
