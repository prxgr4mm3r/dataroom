from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import threading
import time


@dataclass
class _Bucket:
    timestamps: deque[float]


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        normalized_limit = max(1, int(limit))
        normalized_window = max(1, int(window_seconds))
        now = time.monotonic()
        cutoff = now - normalized_window

        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(timestamps=deque())
                self._buckets[key] = bucket

            timestamps = bucket.timestamps
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            if len(timestamps) >= normalized_limit:
                return False

            timestamps.append(now)
            return True
