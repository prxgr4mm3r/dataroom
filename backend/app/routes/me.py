from flask import Blueprint, g, jsonify

from app.auth import require_auth

bp = Blueprint("me", __name__, url_prefix="/api")


@bp.get("/me")
@require_auth
def me():
    user = g.current_user
    return jsonify(
        {
            "id": user.id,
            "firebase_uid": user.firebase_uid,
            "email": user.email,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
        }
    )
