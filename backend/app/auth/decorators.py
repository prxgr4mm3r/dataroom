from __future__ import annotations

from functools import wraps

from flask import g, request

from app.auth.firebase_auth import FirebaseAuthService
from app.errors import ApiError
from app.services.user_service import UserService



def require_auth(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise ApiError(401, "unauthorized", "Missing Bearer token.")

        token = authorization.split(" ", 1)[1].strip()
        claims = FirebaseAuthService().verify_id_token(token)

        user_service = UserService(g.db)
        user = user_service.find_or_create_from_firebase_claims(claims)
        g.current_user = user
        return handler(*args, **kwargs)

    return wrapped
