"""
Unit tests: EmbeddingService (httpx + lexical fallback implementation)
Blueprint refs: AI-EMB-001 → AI-EMB-004

The embedding layer was rewritten to use httpx directly (no local model, no ChromaDB).
These tests verify:
  - lexical scoring correctness
  - retrieve() / retrieve_many() ranking behaviour
  - API path via a mocked _embed_via_api
  - graceful fallback when API fails
"""

from __future__ import annotations

import math
import pytest
from unittest.mock import AsyncMock, patch

from src.ai.embeddings import EmbeddingService, _cosine


# ── Fixtures ──────────────────────────────────────────────────────────────────

CHUNKS = [
    "The contract establishes obligations for the supplier.",
    "Payment terms are due within 30 days of invoice.",
    "The agreement covers software licensing and support.",
    "Termination clauses are detailed in section 8.",
    "Confidentiality obligations apply for 5 years post-termination.",
]

UNRELATED = [
    "Chocolate cake recipe requires flour and eggs.",
    "The weather forecast shows rain tomorrow.",
]


@pytest.fixture
def svc_lexical():
    """EmbeddingService with no API key — always uses lexical scoring."""
    svc = EmbeddingService.__new__(EmbeddingService)
    svc._available = False
    return svc


@pytest.fixture
def svc_api():
    """EmbeddingService configured for API mode."""
    svc = EmbeddingService.__new__(EmbeddingService)
    svc._available = True
    return svc


# ── AI-EMB-001: Lexical scoring ───────────────────────────────────────────────

class TestLexicalScoring:
    """AI-EMB-001: Lexical scorer produces meaningful relevance scores."""

    def test_exact_term_match_scores_higher_than_no_match(self, svc_lexical):
        relevant = "contract obligations supplier"
        noise    = "chocolate cake flour recipe"
        score_rel = svc_lexical._lexical_score("contract supplier", relevant)
        score_noi = svc_lexical._lexical_score("contract supplier", noise)
        assert score_rel > score_noi

    def test_empty_query_returns_zero(self, svc_lexical):
        assert svc_lexical._lexical_score("", "some chunk content") == 0.0

    def test_empty_chunk_returns_zero(self, svc_lexical):
        assert svc_lexical._lexical_score("query terms", "") == 0.0

    def test_score_is_non_negative(self, svc_lexical):
        score = svc_lexical._lexical_score("some query", "some chunk text")
        assert score >= 0.0

    def test_repeated_terms_handled(self, svc_lexical):
        score = svc_lexical._lexical_score("contract contract contract", "contract")
        assert score >= 0.0


# ── AI-EMB-002: retrieve() – lexical mode ────────────────────────────────────

class TestRetrieveLexical:
    """AI-EMB-002: retrieve() returns top-N most relevant chunks (lexical)."""

    @pytest.mark.asyncio
    async def test_returns_top_n_chunks(self, svc_lexical):
        result = await svc_lexical.retrieve("contract obligations", CHUNKS, top_n=2)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_relevant_chunk_ranked_first(self, svc_lexical):
        result = await svc_lexical.retrieve("termination clause section", CHUNKS, top_n=1)
        assert "termination" in result[0].lower() or "clause" in result[0].lower()

    @pytest.mark.asyncio
    async def test_empty_chunks_returns_empty(self, svc_lexical):
        result = await svc_lexical.retrieve("query", [], top_n=3)
        assert result == []

    @pytest.mark.asyncio
    async def test_top_n_capped_at_chunk_count(self, svc_lexical):
        result = await svc_lexical.retrieve("query", ["only one chunk"], top_n=10)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_top_n_minimum_one(self, svc_lexical):
        result = await svc_lexical.retrieve("query", CHUNKS, top_n=0)
        assert len(result) >= 1


# ── AI-EMB-003: retrieve_many() – lexical mode ───────────────────────────────

class TestRetrieveManyLexical:
    """AI-EMB-003: retrieve_many() returns per-query ranked chunk sets."""

    @pytest.mark.asyncio
    async def test_returns_all_query_keys(self, svc_lexical):
        queries = {"summary": "overview", "extract": "names dates"}
        result = await svc_lexical.retrieve_many(queries, CHUNKS, top_n=2)
        assert set(result.keys()) == set(queries.keys())

    @pytest.mark.asyncio
    async def test_each_value_is_list(self, svc_lexical):
        queries = {"a": "contract", "b": "payment terms"}
        result = await svc_lexical.retrieve_many(queries, CHUNKS, top_n=3)
        for v in result.values():
            assert isinstance(v, list)
            assert len(v) <= 3

    @pytest.mark.asyncio
    async def test_empty_chunks_returns_empty_lists(self, svc_lexical):
        queries = {"x": "query"}
        result = await svc_lexical.retrieve_many(queries, [], top_n=3)
        assert result == {"x": []}


# ── AI-EMB-004: API path – mocked ────────────────────────────────────────────

class TestRetrieveAPIPath:
    """AI-EMB-004: API mode uses _embed_via_api and cosine similarity ranking."""

    def _unit_vec(self, dim: int, hot: int) -> list[float]:
        v = [0.0] * dim
        v[hot] = 1.0
        return v

    @pytest.mark.asyncio
    async def test_api_retrieve_uses_cosine_ranking(self, svc_api):
        """Most similar chunk (cosine = 1.0) should rank first."""
        dim = 4
        # query vector at index 0, two chunks: one matching, one orthogonal
        vectors = [
            self._unit_vec(dim, 0),  # query
            self._unit_vec(dim, 0),  # chunk 0 — identical to query (cosine=1)
            self._unit_vec(dim, 1),  # chunk 1 — orthogonal (cosine=0)
        ]
        chunks = ["contract clause obligations", "chocolate cake recipe"]

        with patch.object(svc_api, "_embed_via_api", new=AsyncMock(return_value=vectors)):
            result = await svc_api.retrieve("contract", chunks, top_n=1)

        assert result[0] == "contract clause obligations"

    @pytest.mark.asyncio
    async def test_api_failure_falls_back_to_lexical(self, svc_api):
        """API errors must gracefully fall back to lexical scoring."""
        with patch.object(
            svc_api, "_embed_via_api", side_effect=Exception("network error")
        ):
            result = await svc_api.retrieve("termination clause", CHUNKS, top_n=2)

        assert len(result) == 2
        assert all(isinstance(c, str) for c in result)

    @pytest.mark.asyncio
    async def test_api_retrieve_many_failure_falls_back(self, svc_api):
        """Batch API failure falls back to per-query lexical scoring."""
        queries = {"sum": "payment terms", "wf": "termination clause"}
        with patch.object(
            svc_api, "_embed_via_api", side_effect=Exception("timeout")
        ):
            result = await svc_api.retrieve_many(queries, CHUNKS, top_n=2)

        assert set(result.keys()) == set(queries.keys())
        for v in result.values():
            assert isinstance(v, list)


# ── AI-EMB-005: Cosine similarity helper ─────────────────────────────────────

class TestCosine:
    """AI-EMB-005: _cosine() correctness."""

    def test_identical_vectors_return_one(self):
        v = [1.0, 0.0, 0.0]
        assert _cosine(v, v) == pytest.approx(1.0, abs=1e-6)

    def test_orthogonal_vectors_return_zero(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert _cosine(a, b) == pytest.approx(0.0, abs=1e-6)

    def test_zero_vector_returns_zero(self):
        assert _cosine([0.0, 0.0], [1.0, 0.0]) == 0.0

    def test_empty_input_returns_zero(self):
        assert _cosine([], []) == 0.0
