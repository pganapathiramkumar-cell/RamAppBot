"""Redis-backed conversation memory for multi-turn AI sessions."""

import json
from typing import List
import redis.asyncio as aioredis


class ConversationMemory:
    def __init__(self, redis_url: str, max_turns: int = 20):
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._max_turns = max_turns

    def _key(self, session_id: str) -> str:
        return f"memory:session:{session_id}"

    async def add_message(self, session_id: str, role: str, content: str) -> None:
        key = self._key(session_id)
        message = json.dumps({"role": role, "content": content})
        await self._redis.rpush(key, message)
        await self._redis.ltrim(key, -self._max_turns * 2, -1)
        await self._redis.expire(key, 3600)  # 1-hour TTL

    async def get_history(self, session_id: str) -> List[dict]:
        key = self._key(session_id)
        raw = await self._redis.lrange(key, 0, -1)
        return [json.loads(m) for m in raw]

    async def clear(self, session_id: str) -> None:
        await self._redis.delete(self._key(session_id))
