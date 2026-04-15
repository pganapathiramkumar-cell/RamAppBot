"""
Integration test fixtures.
Blueprint §5.1 — httpx AsyncClient against the real FastAPI app.
All LLM and DB calls are mocked.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock, patch

from src.main import app
from src.core.security import create_test_token


# ── App client ────────────────────────────────────────────────────────────────

@pytest.fixture
async def client(mock_supabase):
    """AsyncClient wired to the FastAPI app with Supabase mocked."""
    with patch("src.services.document_svc.DocumentService.__init__") as mock_init, \
         patch("src.services.analysis_svc.AnalysisService.__init__") as mock_init2:
        mock_init.return_value = None
        mock_init2.return_value = None
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac


@pytest.fixture
async def raw_client():
    """Plain AsyncClient — no mock patches, for auth/header tests."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


# ── Auth helpers ──────────────────────────────────────────────────────────────

@pytest.fixture
def auth_headers_user_a() -> dict:
    token = create_test_token("user-A")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_user_b() -> dict:
    token = create_test_token("user-B")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers(auth_headers_user_a) -> dict:
    """Default authenticated headers (user-A)."""
    return auth_headers_user_a


# ── AI pipeline mock ──────────────────────────────────────────────────────────

@pytest.fixture
def mock_ai_pipeline(mock_llm_response, monkeypatch):
    """Mock the entire AI pipeline — never calls real LLM in integration tests."""
    async def fake_pipeline(document_id: str, text: str):
        return mock_llm_response

    monkeypatch.setattr("src.services.analysis_svc.run_ai_pipeline", fake_pipeline)
    return fake_pipeline
