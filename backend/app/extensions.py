from __future__ import annotations

from pathlib import Path
from typing import Any

from flask import Flask, g
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import Base


def init_extensions(app: Flask) -> None:
    database_url = app.config["DATABASE_URL"]
    connect_args: dict[str, Any] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(database_url, future=True, connect_args=connect_args)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    app.extensions["engine"] = engine
    app.extensions["session_factory"] = session_factory

    upload_dir = Path(app.config["UPLOAD_DIR"])
    upload_dir.mkdir(parents=True, exist_ok=True)

    if app.config.get("AUTO_CREATE_SCHEMA"):
        Base.metadata.create_all(bind=engine)

    CORS(app, resources={r"/api/*": {"origins": [app.config["FRONTEND_URL"]]}})

    @app.before_request
    def open_db_session() -> None:
        g.db = session_factory()

    @app.teardown_request
    def close_db_session(exception: BaseException | None) -> None:
        db: Session | None = g.pop("db", None)
        if db is None:
            return

        if exception is not None:
            db.rollback()
        db.close()


def get_engine(app: Flask) -> Engine:
    return app.extensions["engine"]


def get_db() -> Session:
    db: Session = g.db
    return db
