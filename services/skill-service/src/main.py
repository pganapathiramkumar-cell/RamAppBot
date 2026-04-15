"""Skill Service — FastAPI Application Entry Point."""

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
from src.infrastructure.database.models.skill_model import Base
from src.presentation.api.v1.endpoints.skills import router as skills_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Skill Service] Starting up")

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
        print("[Skill Service] RabbitMQ connected")
    except Exception as exc:
        print(f"[Skill Service] RabbitMQ unavailable ({exc}); using in-memory publisher")
        from src.infrastructure.messaging.event_publisher import InMemoryEventPublisher
        import src.dependencies as deps
        deps._event_publisher = InMemoryEventPublisher()

    # AI client (multi-provider: Groq → NVIDIA → Cerebras → Mock)
    init_ai_client()

    yield

    print("[Skill Service] Shutting down")
    await close_redis()
    await close_db()


app = FastAPI(
    title="Rambot Skill Service",
    description="Enterprise AI Capability & Skill Catalog Management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(skills_router, prefix="/api/v1/skill", tags=["Skills"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "skill-service"}
