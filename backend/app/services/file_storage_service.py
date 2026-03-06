from __future__ import annotations

import hashlib
import os
from pathlib import Path

from werkzeug.utils import secure_filename


class FileStorageService:
    def __init__(self, upload_root: str):
        self.upload_root = Path(upload_root)
        self.upload_root.mkdir(parents=True, exist_ok=True)

    def save_stream(self, user_id: str, file_id: str, original_name: str, content_iterable) -> tuple[str, int, str]:
        user_dir = self.upload_root / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        safe_name = secure_filename(original_name) or "file"
        final_path = user_dir / f"{file_id}_{safe_name}"
        temp_path = final_path.with_suffix(final_path.suffix + ".tmp")

        checksum = hashlib.sha256()
        size_bytes = 0

        try:
            with temp_path.open("wb") as fh:
                for chunk in content_iterable:
                    if not chunk:
                        continue
                    fh.write(chunk)
                    checksum.update(chunk)
                    size_bytes += len(chunk)
            os.replace(temp_path, final_path)
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)

        return str(final_path), size_bytes, checksum.hexdigest()

    @staticmethod
    def delete_file(path: str | None) -> None:
        if not path:
            return
        Path(path).unlink(missing_ok=True)
