"""
FastAPI Dependency Injection factories for Skill Service.
All infrastructure singletons (DB, RabbitMQ) are initialised once
during the app lifespan and injected into use cases via Depends().
"""

from typing import AsyncGenerator, Optional

import aio_pika
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine, async_sessionmaker, create_async_engine

from src.application.queries.get_skills import GetSkillByIdQuery, GetSkillsQuery, SearchSkillsQuery
from src.application.use_cases.approve_skill import ApproveSkillUseCase
from src.application.use_cases.create_skill import CreateSkillUseCase
from src.application.use_cases.deploy_skill import DeploySkillUseCase
from src.application.use_cases.deprecate_skill import DeprecateSkillUseCase
from src.application.use_cases.submit_skill_for_review import SubmitSkillForReviewUseCase
from src.application.use_cases.update_skill_metrics import UpdateSkillMetricsUseCase
from src.infrastructure.ai.skill_ai_client import SkillAIClient
from src.infrastructure.database.repositories.skill_repo_impl import PostgresSkillRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher, RabbitMQEventPublisher

# ---------------------------------------------------------------------------
# Module-level singletons — set by init_* helpers called from main.py lifespan
# ---------------------------------------------------------------------------
_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker] = None
_rabbitmq_connection: Optional[aio_pika.abc.AbstractConnection] = None
_event_publisher: Optional[IEventPublisher] = None
_ai_client: Optional[SkillAIClient] = None


def init_db(database_url: str) -> None:
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False, autoflush=False)


def set_rabbitmq_connection(connection: aio_pika.abc.AbstractConnection) -> None:
    global _rabbitmq_connection, _event_publisher
    _rabbitmq_connection = connection
    _event_publisher = RabbitMQEventPublisher(connection)


def init_ai_client(ollama_url: str, model: str) -> None:
    global _ai_client
    _ai_client = SkillAIClient(base_url=ollama_url, model=model)


async def close_db() -> None:
    if _engine:
        await _engine.dispose()


# ---------------------------------------------------------------------------
# FastAPI Depends providers
# ---------------------------------------------------------------------------

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        async with session.begin():
            yield session


def get_event_publisher() -> IEventPublisher:
    return _event_publisher


def get_ai_client() -> SkillAIClient:
    return _ai_client


# ---------------------------------------------------------------------------
# Use-case Depends (compose lower-level Depends)
# ---------------------------------------------------------------------------

from fastapi import Depends  # noqa: E402 — import after singletons defined


async def get_create_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
    ai_client: SkillAIClient = Depends(get_ai_client),
) -> CreateSkillUseCase:
    return CreateSkillUseCase(
        repository=PostgresSkillRepository(session),
        ai_client=ai_client,
        event_publisher=publisher,
    )


async def get_skills_query(
    session: AsyncSession = Depends(get_db_session),
) -> GetSkillsQuery:
    return GetSkillsQuery(repository=PostgresSkillRepository(session))


async def get_skill_by_id_query(
    session: AsyncSession = Depends(get_db_session),
) -> GetSkillByIdQuery:
    return GetSkillByIdQuery(repository=PostgresSkillRepository(session))


async def get_search_query(
    session: AsyncSession = Depends(get_db_session),
) -> SearchSkillsQuery:
    return SearchSkillsQuery(repository=PostgresSkillRepository(session))


async def get_submit_review_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> SubmitSkillForReviewUseCase:
    return SubmitSkillForReviewUseCase(
        repository=PostgresSkillRepository(session),
        event_publisher=publisher,
    )


async def get_approve_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> ApproveSkillUseCase:
    return ApproveSkillUseCase(
        repository=PostgresSkillRepository(session),
        event_publisher=publisher,
    )


async def get_deploy_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> DeploySkillUseCase:
    return DeploySkillUseCase(
        repository=PostgresSkillRepository(session),
        event_publisher=publisher,
    )


async def get_deprecate_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> DeprecateSkillUseCase:
    return DeprecateSkillUseCase(
        repository=PostgresSkillRepository(session),
        event_publisher=publisher,
    )


async def get_update_metrics_use_case(
    session: AsyncSession = Depends(get_db_session),
    publisher: IEventPublisher = Depends(get_event_publisher),
) -> UpdateSkillMetricsUseCase:
    return UpdateSkillMetricsUseCase(
        repository=PostgresSkillRepository(session),
        event_publisher=publisher,
    )
