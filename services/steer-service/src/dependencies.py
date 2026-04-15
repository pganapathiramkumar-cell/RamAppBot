"""
FastAPI Dependency Injection factories for Steer Service.
All infrastructure singletons (DB, Redis, RabbitMQ, LLM) are initialised once
during the app lifespan and injected into use cases via Depends().
"""

from typing import AsyncGenerator, Optional

import aio_pika
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, async_sessionmaker, create_async_engine

from src.application.queries.get_steer_goals import GetSteerGoalByIdQuery, GetSteerGoalsQuery
from src.application.use_cases.activate_steer_goal import ActivateSteerGoalUseCase
from src.application.use_cases.complete_steer_goal import CompleteSteerGoalUseCase
from src.application.use_cases.create_steer_goal import CreateSteerGoalUseCase
from src.application.use_cases.update_steer_goal import UpdateSteerGoalUseCase
from src.infrastructure.ai.llm_client import LLMClient
from src.infrastructure.ai.steer_ai_client import SteerAIClient
from src.infrastructure.cache.redis_cache import RedisCache
from src.infrastructure.database.repositories.steer_goal_repo_impl import PostgresSteerGoalRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher, RabbitMQEventPublisher

# ---------------------------------------------------------------------------
# Module-level singletons — set by init_* helpers called from main.py lifespan
# ---------------------------------------------------------------------------
_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker] = None
_redis: Optional[RedisCache] = None
_rabbitmq_connection: Optional[aio_pika.abc.AbstractConnection] = None
_event_publisher: Optional[IEventPublisher] = None
_ai_client: Optional[SteerAIClient] = None


def init_db(database_url: str) -> None:
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False, autoflush=False)


def init_redis(redis_url: str) -> None:
    global _redis
    _redis = RedisCache(redis_url)


def set_rabbitmq_connection(connection: aio_pika.abc.AbstractConnection) -> None:
    global _rabbitmq_connection, _event_publisher
    _rabbitmq_connection = connection
    _event_publisher = RabbitMQEventPublisher(connection)


def init_ai_client() -> None:
    global _ai_client
    _ai_client = SteerAIClient(llm=LLMClient())


async def close_db() -> None:
    if _engine:
        await _engine.dispose()


async def close_redis() -> None:
    if _redis:
        await _redis.close()


# ---------------------------------------------------------------------------
# FastAPI Depends providers
# ---------------------------------------------------------------------------

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        async with session.begin():
            yield session


def get_event_publisher() -> IEventPublisher:
    return _event_publisher


def get_cache() -> RedisCache:
    return _redis


def get_ai_client() -> SteerAIClient:
    return _ai_client


# ---------------------------------------------------------------------------
# Use-case Depends (compose lower-level Depends)
# ---------------------------------------------------------------------------

from fastapi import Depends  # noqa: E402 — import after singletons defined


async def get_create_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> CreateSteerGoalUseCase:
    return CreateSteerGoalUseCase(
        repository=PostgresSteerGoalRepository(session),
        event_publisher=publisher,
    )


async def get_update_use_case(
    session: AsyncSession = Depends(get_db_session),
    cache: RedisCache = Depends(get_cache),
) -> UpdateSteerGoalUseCase:
    return UpdateSteerGoalUseCase(
        repository=PostgresSteerGoalRepository(session),
        cache=cache,
    )


async def get_list_query(
    session: AsyncSession = Depends(get_db_session),
    cache: RedisCache = Depends(get_cache),
) -> GetSteerGoalsQuery:
    return GetSteerGoalsQuery(
        repository=PostgresSteerGoalRepository(session),
        cache=cache,
    )


async def get_by_id_query(
    session: AsyncSession = Depends(get_db_session),
) -> GetSteerGoalByIdQuery:
    return GetSteerGoalByIdQuery(
        repository=PostgresSteerGoalRepository(session),
    )


async def get_activate_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> ActivateSteerGoalUseCase:
    return ActivateSteerGoalUseCase(
        repository=PostgresSteerGoalRepository(session),
        event_publisher=publisher,
    )


async def get_complete_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> CompleteSteerGoalUseCase:
    return CompleteSteerGoalUseCase(
        repository=PostgresSteerGoalRepository(session),
        event_publisher=publisher,
    )
