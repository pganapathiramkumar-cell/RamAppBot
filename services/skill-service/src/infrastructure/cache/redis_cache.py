"""Redis cache wrapper for skill service."""

import json
from typing import Any, Optional
import redis.asyncio as aioredis


class RedisCache:
    def __init__(self, url: str, default_ttl: int = 300):
        self._client = aioredis.from_url(url, decode_responses=True)
        self._default_ttl = default_ttl

    async def get(self, key: str) -> Optional[Any]:
        value = await self._client.get(key)
        return json.loads(value) if value else None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        await self._client.setex(key, ttl or self._default_ttl, json.dumps(value, default=str))

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def invalidate_pattern(self, pattern: str) -> None:
        keys = await self._client.keys(pattern)
        if keys:
            await self._client.delete(*keys)

    async def close(self) -> None:
        await self._client.aclose()
