from __future__ import annotations

import logging
from dataclasses import dataclass

from flask import Flask, jsonify
from sqlalchemy.exc import IntegrityError


logger = logging.getLogger(__name__)


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": self.message,
        }


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return jsonify({"error": error.to_dict()}), error.status_code

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(error: IntegrityError):
        logger.warning("Integrity error: %s", error)
        return (
            jsonify(
                {
                    "error": {
                        "code": "conflict",
                        "message": "Database conflict.",
                    }
                }
            ),
            409,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        logger.exception("Unhandled exception: %s", error)
        return (
            jsonify(
                {
                    "error": {
                        "code": "internal_server_error",
                        "message": "Unexpected server error.",
                    }
                }
            ),
            500,
        )
