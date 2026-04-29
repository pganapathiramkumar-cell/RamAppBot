"""
Root conftest.py — shared fixtures for all Document Service tests.
Blueprint: DocuMind Testing Architecture v1.0 §4.1
Key principle: ALL unit/integration tests use pre-recorded LLM fixtures (never real AI).
"""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

# ── File Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Minimal valid PDF bytes — passes magic-byte check."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"


@pytest.fixture
def large_pdf_bytes() -> bytes:
    """Bytes that look like PDF but exceed 5 MB."""
    return b"%PDF-1.4\n" + b"x" * (5 * 1024 * 1024 + 1)


@pytest.fixture
def png_bytes() -> bytes:
    """PNG magic bytes — should be rejected as non-PDF."""
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


# ── Pre-Recorded LLM Response Fixtures ───────────────────────────────────────

_FIXTURES_DIR = Path(__file__).parent / "fixtures" / "llm_responses"


@pytest.fixture
def llm_summary_response() -> str:
    data = json.loads((_FIXTURES_DIR / "summarize_v1.json").read_text())
    return data["response"]["content"]


@pytest.fixture
def llm_extract_response() -> str:
    data = json.loads((_FIXTURES_DIR / "extract_v1.json").read_text())
    return data["response"]["content"]


@pytest.fixture
def llm_workflow_response() -> str:
    data = json.loads((_FIXTURES_DIR / "workflow_v1.json").read_text())
    return data["response"]["content"]


@pytest.fixture
def mock_llm_response() -> dict:
    """Full mock response object matching the AI pipeline output shape."""
    return {
        "summary": (
            "This contract establishes a service agreement between Acme Corp and John Smith, "
            "effective April 1, 2026.  Key terms include a 12-month engagement period, "
            "a non-disclosure clause (Section 4), and termination provisions (Section 7)."
        ),
        "entities": {
            "names": ["Acme Corp", "John Smith"],
            "dates": ["2026-04-01", "2026-12-31"],
            "clauses": ["Non-disclosure clause Section 4", "Termination provisions Section 7"],
            "tasks": ["Sign and return agreement by April 30"],
            "risks": ["Termination without cause (Section 7)"],
        },
        "workflow": [
            {"step_number": 1, "action": "Review contract terms with legal counsel", "priority": "High"},
            {"step_number": 2, "action": "Sign and return agreement before April 30", "priority": "High"},
            {"step_number": 3, "action": "Notify finance team of payment schedule", "priority": "Medium"},
        ],
    }


# ── LLM Client Mock ───────────────────────────────────────────────────────────

@pytest.fixture
def mock_llm(llm_summary_response, llm_extract_response):
    """
    Mock LLMClient — returns pre-recorded fixture responses, never calls real API.
    ainvoke returns LLMResponse(content=...).
    """
    from src.ai.llm_client import LLMResponse

    mock = AsyncMock()
    mock.ainvoke = AsyncMock(return_value=LLMResponse(content=llm_summary_response))
    return mock


# ── Supabase Mock ─────────────────────────────────────────────────────────────

@pytest.fixture
def mock_supabase():
    """Mock Supabase client for all unit tests — no real DB."""
    mock = MagicMock()
    # Default: insert returns a new document record
    mock.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "doc-123", "status": "pending", "filename": "test.pdf", "user_id": "user-1"}]
    )
    # Default: select returns empty (no duplicate)
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock.storage.from_.return_value.upload = MagicMock(return_value={"Key": "documents/path"})
    return mock
