from flask import Flask

from app.routes.files import bp as files_bp
from app.routes.folders import bp as folders_bp
from app.routes.google_integration import bp as google_bp
from app.routes.health import bp as health_bp
from app.routes.items import bp as items_bp
from app.routes.me import bp as me_bp
from app.routes.public_shares import bp as public_shares_bp
from app.routes.shares import bp as shares_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(me_bp)
    app.register_blueprint(google_bp)
    app.register_blueprint(folders_bp)
    app.register_blueprint(items_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(shares_bp)
    app.register_blueprint(public_shares_bp)
