from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.services.magic_link_email_service import MagicLinkEmailService

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/magic-link")
def send_magic_link():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip()

    MagicLinkEmailService(current_app.config).send_sign_in_email(email)
    return jsonify({"status": "sent"})
