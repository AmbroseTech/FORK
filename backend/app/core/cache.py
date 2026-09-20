"""Redis access with a transparent in-memory fallback.

Redis is used for caching, rate limiting, usage counters and short-lived tokens.
PostgreSQL remains the source of truth; if Redis is unreachable the app keeps
working (slower, single-process) instead of crashing.
"""

from __future__ import annotations

import logging
import threading
import time
from functools import lru_cache

import redis

from app.core.config import get_settings

log = logging.getLogger(__name__)


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, tuple[str, float | None]] = {}
        self._lock = threading.Lock()

    def _purge(self, key: str) -> None:
        item = self._data.get(key)
        if item and item[1] is not None and item[1] < time.time():
            del self._data[key]

    def get(self, key: str) -> str | None:
        with self._lock:
            self._purge(key)
            item = self._data.get(key)
            return item[0] if item else None

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        with self._lock:
            self._data[key] = (value, time.time() + ex if ex else None)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def incr(self, key: str, ex: int | None = None) -> int:
        with self._lock:
            self._purge(key)
            item = self._data.get(key)
            value = int(item[0]) + 1 if item else 1
            expiry = item[1] if item else (time.time() + ex if ex else None)
            self._data[key] = (str(value), expiry)
            return value

    def ping(self) -> bool:
        return True


class Cache:
    def __init__(self, url: str) -> None:
        self._memory = MemoryStore()
        self._redis: redis.Redis | None = None
        try:
            client: redis.Redis = redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1, decode_responses=True)
            client.ping()
            self._redis = client
        except (redis.RedisError, OSError) as exc:
            log.warning("Redis unavailable (%s); using in-memory fallback", exc.__class__.__name__)

    @property
    def backend(self) -> str:
        return "redis" if self._redis else "memory"

    def healthy(self) -> bool:
        if not self._redis:
            return False
        try:
            return bool(self._redis.ping())
        except (redis.RedisError, OSError):
            return False

    def get(self, key: str) -> str | None:
        if self._redis:
            try:
                value = self._redis.get(key)
                return str(value) if value is not None else None
            except (redis.RedisError, OSError):
                pass
        return self._memory.get(key)

    def set(self, key: str, value: str, ex: int | None = None) -> None:
        if self._redis:
            try:
                self._redis.set(key, value, ex=ex)
                return
            except (redis.RedisError, OSError):
                pass
        self._memory.set(key, value, ex=ex)

    def delete(self, key: str) -> None:
        if self._redis:
            try:
                self._redis.delete(key)
                return
            except (redis.RedisError, OSError):
                pass
        self._memory.delete(key)

    def incr(self, key: str, ex: int | None = None) -> int:
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(key)
                if ex:
                    pipe.expire(key, ex, nx=True)
                result = pipe.execute()
                return int(result[0])
            except (redis.RedisError, OSError):
                pass
        return self._memory.incr(key, ex=ex)


@lru_cache
def get_cache() -> Cache:
    return Cache(get_settings().redis_url)
