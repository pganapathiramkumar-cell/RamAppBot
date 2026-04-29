"""
API integration tests: Analysis endpoints
Blueprint refs: API-AN-001 → API-AN-003
Uses httpx AsyncClient against the real FastAPI app.
AI pipeline and DB are fully mocked.
"""

import pytest
from unittest.mock import AsyncMock, patch

from src.core.exceptions import AnalysisNotReadyError, DocumentNotFoundError


class TestAnalysisAPI:
    """API-AN: Analysis retrieval and retry endpoint tests."""

    @pytest.mark.asyncio
    async def test_api_an_001_done_analysis_returns_full_result(
        self, raw_client, auth_headers, mock_llm_response
    ):
        """GET /analyses/{id} with status=done returns summary + entities + workflow."""
        mock_svc = AsyncMock()
        mock_svc.get_analysis.return_value = mock_llm_response

        with patch("src.main.AnalysisService", return_value=mock_svc):
            response = await raw_client.get(
                "/api/v1/analyses/doc-123",
                headers=auth_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert "summary" in body
        assert isinstance(body["summary"], str)
        assert len(body["summary"]) > 0

        assert "entities" in body
        entities = body["entities"]
        for key in ("names", "dates", "clauses", "tasks", "risks"):
            assert key in entities, f"Missing entity key: {key}"
            assert isinstance(entities[key], list)

        assert "workflow" in body
        assert isinstance(body["workflow"], list)
        assert len(body["workflow"]) >= 1
        for step in body["workflow"]:
            assert "step_number" in step
            assert "action" in step
            assert "priority" in step

    @pytest.mark.asyncio
    async def test_api_an_002_processing_status_returns_200(
        self, raw_client, auth_headers
    ):
        """GET /analyses/{id} when status=processing returns 200 with status field.
        The API uses 200+body (not 202) so the mobile poller always gets a parseable
        response regardless of state."""
        mock_svc = AsyncMock()
        mock_svc.get_analysis.side_effect = AnalysisNotReadyError("doc-123", "processing")

        with patch("src.main.AnalysisService", return_value=mock_svc):
            response = await raw_client.get(
                "/api/v1/analyses/doc-123",
                headers=auth_headers,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "processing"
        assert body["document_id"] == "doc-123"

    @pytest.mark.asyncio
    async def test_api_an_002_pending_status_returns_200(
        self, raw_client, auth_headers
    ):
        """status=pending also returns 200 with status field (not yet started)."""
        mock_svc = AsyncMock()
        mock_svc.get_analysis.side_effect = AnalysisNotReadyError("doc-123", "pending")

        with patch("src.main.AnalysisService", return_value=mock_svc):
            response = await raw_client.get(
                "/api/v1/analyses/doc-123",
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_api_an_003_retry_resets_failed_analysis(
        self, raw_client, auth_headers
    ):
        """POST /analyses/{id}/retry on a failed doc resets status to pending."""
        mock_svc = AsyncMock()
        mock_svc.retry_analysis.return_value = {"id": "doc-123", "status": "pending"}

        with patch("src.main.AnalysisService", return_value=mock_svc):
            response = await raw_client.post(
                "/api/v1/analyses/doc-123/retry",
                headers=auth_headers,
            )
        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_api_an_004_analysis_of_nonexistent_doc_returns_404(
        self, raw_client, auth_headers
    ):
        """GET /analyses/{id} for a document not owned by user returns 404."""
        mock_svc = AsyncMock()
        mock_svc.get_analysis.side_effect = DocumentNotFoundError("doc-missing")

        with patch("src.main.AnalysisService", return_value=mock_svc):
            response = await raw_client.get(
                "/api/v1/analyses/doc-missing",
                headers=auth_headers,
            )
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_api_an_005_no_auth_analysis_returns_401(self, raw_client):
        """GET /analyses/{id} without token returns 401."""
        response = await raw_client.get("/api/v1/analyses/doc-123")
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "AUTH_REQUIRED"

    @pytest.mark.asyncio
    async def test_api_an_006_retry_without_auth_returns_401(self, raw_client):
        """POST /analyses/{id}/retry without token returns 401."""
        response = await raw_client.post("/api/v1/analyses/doc-123/retry")
        assert response.status_code == 401
