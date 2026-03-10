from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.errors import ApiError
from app.services.magic_link_email_service import MagicLinkEmailService
from app.services.rate_limit_service import InMemoryRateLimiter

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _resolve_client_ip() -> str:
    if request.access_route:
        value = str(request.access_route[0]).strip()
        if value:
            return value
    remote_addr = str(request.remote_addr or "").strip()
    return remote_addr or "unknown"


def _enforce_magic_link_rate_limit(email: str) -> None:
    limiter: InMemoryRateLimiter = current_app.extensions["magic_link_rate_limiter"]

    ip_limit = int(current_app.config["AUTH_MAGIC_LINK_RATE_LIMIT_IP_LIMIT"])
    ip_window = int(current_app.config["AUTH_MAGIC_LINK_RATE_LIMIT_IP_WINDOW_SECONDS"])
    email_limit = int(current_app.config["AUTH_MAGIC_LINK_RATE_LIMIT_EMAIL_LIMIT"])
    email_window = int(current_app.config["AUTH_MAGIC_LINK_RATE_LIMIT_EMAIL_WINDOW_SECONDS"])

    client_ip = _resolve_client_ip()
    if not limiter.allow(f"magic-link:ip:{client_ip}", ip_limit, ip_window):
        raise ApiError(
            429,
            "rate_limited",
            "Too many sign-in link requests. Please try again later.",
        )

    normalized_email = email.strip().lower()
    if normalized_email and not limiter.allow(f"magic-link:email:{normalized_email}", email_limit, email_window):
        raise ApiError(
            429,
            "rate_limited",
            "Too many sign-in link requests for this email. Please try again later.",
        )


@bp.post("/magic-link")
def send_magic_link():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip()
    _enforce_magic_link_rate_limit(email)

    MagicLinkEmailService(current_app.config).send_sign_in_email(email)
    return jsonify({"status": "sent"})
