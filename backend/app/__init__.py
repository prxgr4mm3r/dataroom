from __future__ import annotations

from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from flask import Flask

from app.config import build_config
from app.errors import register_error_handlers
from app.extensions import get_engine, init_extensions
from app.models import Base
from app.routes import register_routes


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def create_app(config_overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.update(build_config(config_overrides))

    init_extensions(app)
    register_error_handlers(app)
    register_routes(app)

    register_cli_commands(app)
    return app



def register_cli_commands(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db_command() -> None:
        """Create database tables."""
        engine = get_engine(app)
        Base.metadata.create_all(bind=engine)
        print("Database tables created.")
