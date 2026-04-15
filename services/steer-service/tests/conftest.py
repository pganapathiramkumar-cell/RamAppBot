"""
Root conftest.py — shared fixtures for all Steer Service tests.
Blueprint: DocuMind Testing Architecture v1.0 — adapted for Steer Service.
Key principle: ALL unit/integration tests use pre-recorded LLM fixtures (never real AI).
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timedelta

from src.domain.entities.steer_goal import (
    SteerGoal, SteerGoalStatus, SteerGoalType, SteerGoalPriority
)
from src.infrastructure.messaging.event_publisher import InMemoryEventPublisher


# ── Event Loop ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ── Domain Fixtures ───────────────────────────────────────────────────────────
@pytest.fixture
def org_id() -> UUID:
    return UUID("00000000-0000-0000-0000-000000000001")


@pytest.fixture
def owner_id() -> UUID:
    return UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture
def make_goal(org_id, owner_id):
    """Factory: create a SteerGoal with sensible defaults."""
    def _factory(**kwargs) -> SteerGoal:
        defaults = dict(
            title="Achieve 90% AI Model Accuracy",
            description="Ensure all production AI models meet 90% accuracy threshold by Q3.",
            goal_type=SteerGoalType.STRATEGIC,
            priority=SteerGoalPriority.HIGH,
            owner_id=owner_id,
            organization_id=org_id,
            success_criteria=["Model accuracy >= 90%", "Latency < 200ms"],
        )
        return SteerGoal(**{**defaults, **kwargs})
    return _factory


@pytest.fixture
def active_goal(make_goal) -> SteerGoal:
    goal = make_goal()
    goal.activate()
    return goal


@pytest.fixture
def overdue_goal(make_goal) -> SteerGoal:
    goal = make_goal(target_date=datetime.utcnow() - timedelta(days=5))
    goal.activate()
    return goal


# ── Repository Mocks ──────────────────────────────────────────────────────────
@pytest.fixture
def mock_repository():
    repo = AsyncMock()
    repo.save = AsyncMock(side_effect=lambda g: g)
    repo.find_by_id = AsyncMock(return_value=None)
    repo.find_by_organization = AsyncMock(return_value=[])
    repo.delete = AsyncMock()
    repo.count_by_organization = AsyncMock(return_value=0)
    return repo


# ── Event Publisher ───────────────────────────────────────────────────────────
@pytest.fixture
def event_publisher() -> InMemoryEventPublisher:
    return InMemoryEventPublisher()


# ── Pre-Recorded LLM Response Fixtures (never real AI in fast CI path) ────────
@pytest.fixture
def llm_alignment_score_response() -> str:
    """Pre-recorded Claude response for alignment score computation."""
    return '{"score": 0.82}'


@pytest.fixture
def llm_recommendations_response() -> str:
    """Pre-recorded Claude response for goal recommendations."""
    return json.dumps([
        "Establish model accuracy KPIs with monthly review cadence",
        "Implement automated model evaluation pipeline",
        "Define fallback strategy for models below 85% accuracy",
        "Assign AI governance lead to track compliance"
    ])


@pytest.fixture
def llm_steer_analysis_response() -> str:
    """Pre-recorded Claude agent analysis response."""
    return (
        "Based on your current AI strategic posture, your organization scores 78% alignment. "
        "Critical gaps identified: Explainability (low maturity) and MLOps automation (manual processes). "
        "Top recommendation: prioritize the Operational goal tier to bridge tactical execution gaps."
    )


@pytest.fixture
def mock_ai_client(llm_alignment_score_response, llm_recommendations_response):
    """Mock SteerAIClient — returns fixtures, never calls real API."""
    client = AsyncMock()
    client.compute_alignment_score = AsyncMock(return_value=0.82)
    client.generate_recommendations = AsyncMock(return_value=[
        "Establish model accuracy KPIs with monthly review cadence",
        "Implement automated model evaluation pipeline",
        "Define fallback strategy for models below 85% accuracy",
    ])
    return client


@pytest.fixture
def mock_ollama_client(llm_alignment_score_response):
    """Mock raw Ollama client — simulates local model response without daemon."""
    mock_message = MagicMock()
    mock_message.content = llm_alignment_score_response
    mock_message.tool_calls = None

    mock_response = MagicMock()
    mock_response.message = mock_message

    client = AsyncMock()
    client.chat = AsyncMock(return_value=mock_response)
    return client
