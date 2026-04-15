"""Sliding-window rate limiter backed by Redis."""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as aioredis

from src.config.settings import settings

RATE_LIMIT = 200          # requests
WINDOW_SECONDS = 60       # per minute

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        key = f"rate:{client_ip}"

        try:
            r = await get_redis()
            now = int(time.time())
            window_start = now - WINDOW_SECONDS

            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, WINDOW_SECONDS)
            results = await pipe.execute()
            request_count = results[2]

            if request_count > RATE_LIMIT:
                return JSONResponse(
                    {"detail": "Rate limit exceeded. Try again in a minute."},
                    status_code=429,
                    headers={"Retry-After": str(WINDOW_SECONDS)},
                )
        except Exception:
            pass  # Redis unavailable → fail open

        return await call_next(request)
