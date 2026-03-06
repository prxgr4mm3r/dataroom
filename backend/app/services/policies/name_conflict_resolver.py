from __future__ import annotations

from pathlib import Path
import re


class NameConflictResolver:
    @staticmethod
    def normalize(name: str) -> str:
        compact = re.sub(r"\s+", " ", name).strip()
        return compact.casefold()

    @staticmethod
    def validate(name: str) -> str:
        cleaned = re.sub(r"\s+", " ", name).strip()
        if not cleaned:
            raise ValueError("invalid_name")
        if len(cleaned) > 512:
            raise ValueError("invalid_name")
        if "/" in cleaned or "\\" in cleaned:
            raise ValueError("invalid_name")
        return cleaned

    def resolve_unique(self, requested_name: str, existing_normalized_names: set[str]) -> str:
        validated = self.validate(requested_name)
        if self.normalize(validated) not in existing_normalized_names:
            return validated

        base, ext = self._split_base_ext(validated)
        suffix = 1
        while True:
            candidate = f"{base} ({suffix}){ext}"
            if self.normalize(candidate) not in existing_normalized_names:
                return candidate
            suffix += 1

    @staticmethod
    def _split_base_ext(name: str) -> tuple[str, str]:
        suffix = Path(name).suffix
        if not suffix:
            return name, ""
        return name[: -len(suffix)], suffix
