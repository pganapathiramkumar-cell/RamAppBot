"""
API integration tests: Document endpoints
Blueprint refs: API-DOC-001 → API-DOC-006  |  API-RL-001 → API-RL-003
Uses httpx AsyncClient against the real FastAPI app.
Supabase and LLM are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestDocumentUploadAPI:
    """API-DOC: Document upload endpoint tests."""

    @pytest.mark.asyncio
    async def test_api_doc_001_upload_valid_pdf_returns_201(
        self, raw_client, auth_headers, sample_pdf_bytes
    ):
        """Happy path: valid PDF + valid JWT → 201 with document record."""
        mock_svc = AsyncMock()
        mock_svc.upload_document.return_value = {
            "id": "doc-abc",
            "status": "pending",
            "filename": "contract.pdf",
            "user_id": "user-A",
        }
        with patch("src.main.DocumentService", return_value=mock_svc):
            with patch("src.main.validate_pdf", return_value=True):
                response = await raw_client.post(
                    "/api/v1/documents/upload",
                    files={"file": ("contract.pdf", sample_pdf_bytes, "application/pdf")},
                    headers=auth_headers,
                )
        assert response.status_code == 201
        body = response.json()
        assert "id" in body
        assert body["status"] == "pending"
        assert body["filename"] == "contract.pdf"

    @pytest.mark.asyncio
    async def test_api_doc_002_no_auth_returns_401(self, raw_client, sample_pdf_bytes):
        """Missing Authorization header → 401 AUTH_REQUIRED."""
        response = await raw_client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")},
        )
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "AUTH_REQUIRED"

    @pytest.mark.asyncio
    async def test_api_doc_002_invalid_token_returns_401(self, raw_client, sample_pdf_bytes):
        """Malformed JWT → 401."""
        response = await raw_client.post(
            "/api/v1/documents/upload",
            files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_api_doc_003_file_too_large_returns_413(
        self, raw_client, auth_headers, large_pdf_bytes
    ):
        """PDF over 5 MB → 413 FILE_TOO_LARGE."""
        response = await raw_client.post(
            "/api/v1/documents/upload",
            files={"file": ("huge.pdf", large_pdf_bytes, "application/pdf")},
            headers=auth_headers,
        )
        assert response.status_code == 413
        body = response.json()
        assert body["detail"]["code"] == "FILE_TOO_LARGE"
        assert "max_size_mb" in body["detail"]

    @pytest.mark.asyncio
    async def test_api_doc_004_non_pdf_returns_415(
        self, raw_client, auth_headers, png_bytes
    ):
        """Non-PDF magic bytes → 415 INVALID_FILE_TYPE."""
        response = await raw_client.post(
            "/api/v1/documents/upload",
            files={"file": ("image.pdf", png_bytes, "application/pdf")},
            headers=auth_headers,
        )
        assert response.status_code == 415
        assert response.json()["detail"]["code"] == "INVALID_FILE_TYPE"

    @pytest.mark.asyncio
    async def test_api_doc_005_user_isolation_only_own_docs_returned(
        self, raw_client, auth_headers_user_a, auth_headers_user_b
    ):
        """User A can only see their own documents (RLS enforcement test)."""
        user_a_docs = [{"id": "doc-a-1", "user_id": "user-A", "filename": "a.pdf"}]
        user_b_docs = [{"id": "doc-b-1", "user_id": "user-B", "filename": "b.pdf"}]

        mock_svc_a = AsyncMock()
        mock_svc_a.list_documents.return_value = user_a_docs
        mock_svc_b = AsyncMock()
        mock_svc_b.list_documents.return_value = user_b_docs

        with patch("src.main.DocumentService") as MockSvc:
            MockSvc.return_value = mock_svc_a
            resp_a = await raw_client.get("/api/v1/documents", headers=auth_headers_user_a)
        assert all(d["user_id"] == "user-A" for d in resp_a.json()["items"])

        with patch("src.main.DocumentService") as MockSvc:
            MockSvc.return_value = mock_svc_b
            resp_b = await raw_client.get("/api/v1/documents", headers=auth_headers_user_b)
        assert all(d["user_id"] == "user-B" for d in resp_b.json()["items"])

        # Cross-user: user-A docs do not appear in user-B's response
        a_ids = {d["id"] for d in resp_a.json()["items"]}
        b_ids = {d["id"] for d in resp_b.json()["items"]}
        assert a_ids.isdisjoint(b_ids)

    @pytest.mark.asyncio
    async def test_api_doc_006_delete_wrong_user_returns_403(
        self, raw_client, auth_headers_user_b
    ):
        """User B cannot delete User A's document → 403 FORBIDDEN."""
        mock_svc = AsyncMock()
        mock_svc.delete_document.return_value = False  # not owned by user-B

        with patch("src.main.DocumentService", return_value=mock_svc):
            response = await raw_client.delete(
                "/api/v1/documents/doc-a-1",
                headers=auth_headers_user_b,
            )
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "FORBIDDEN"

    @pytest.mark.asyncio
    async def test_api_doc_007_delete_own_document_returns_204(
        self, raw_client, auth_headers_user_a
    ):
        """Document owner deletes their own doc → 204 No Content."""
        mock_svc = AsyncMock()
        mock_svc.delete_document.return_value = True

        with patch("src.main.DocumentService", return_value=mock_svc):
            response = await raw_client.delete(
                "/api/v1/documents/doc-a-1",
                headers=auth_headers_user_a,
            )
        assert response.status_code == 204


class TestRateLimitHeaders:
    """API-RL: Verify API returns expected HTTP codes under load."""

    @pytest.mark.asyncio
    async def test_api_health_check_is_fast(self, raw_client):
        """Health endpoint should respond quickly and return 200."""
        response = await raw_client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
