from flask import Flask

from app.routes.files import bp as files_bp
from app.routes.google_integration import bp as google_bp
from app.routes.health import bp as health_bp
from app.routes.me import bp as me_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(me_bp)
    app.register_blueprint(google_bp)
    app.register_blueprint(files_bp)
