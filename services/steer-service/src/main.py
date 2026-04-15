"""Steer Service — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager

import aio_pika
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings
from src.dependencies import (
    close_db,
    close_redis,
    init_ai_client,
    init_db,
    init_redis,
    set_rabbitmq_connection,
)

from src.infrastructure.database.models.steer_goal_model import Base
from src.presentation.api.v1.endpoints.steer_goals import router as goals_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Steer Service] Starting up")

    # Database
    init_db(settings.DATABASE_URL)

    # Create tables on first run (use Alembic in production)
    from src.dependencies import _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Redis
    init_redis(settings.REDIS_URL)

    # RabbitMQ
    try:
        connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
        set_rabbitmq_connection(connection)
        print("[Steer Service] RabbitMQ connected")
    except Exception as exc:
        print(f"[Steer Service] RabbitMQ unavailable ({exc}); using in-memory publisher")
        from src.infrastructure.messaging.event_publisher import InMemoryEventPublisher
        from src.dependencies import _event_publisher
        import src.dependencies as deps
        deps._event_publisher = InMemoryEventPublisher()

    # AI client (multi-provider: Groq → NVIDIA → Cerebras → Mock)
    init_ai_client()

    yield

    print("[Steer Service] Shutting down")
    await close_redis()
    await close_db()


app = FastAPI(
    title="Rambot Steer Service",
    description="Enterprise AI Strategic Goal Management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(goals_router, prefix="/api/v1/steer", tags=["Steer Goals"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "steer-service"}
