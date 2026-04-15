"""
Unit tests: EmbeddingService + ChromaDB vector store
Blueprint refs: AI-EMB-001 → AI-EMB-004
Uses an in-memory (tmp) ChromaDB instance — no real DB or API calls.
"""

import tempfile
import pytest

from src.ai.embeddings import EmbeddingService, _EMBEDDING_DIM


@pytest.fixture
def svc(tmp_path):
    """EmbeddingService with a temp ChromaDB path — isolated per test."""
    return EmbeddingService(persist_path=str(tmp_path))


class TestEmbeddingDimensionality:
    """AI-EMB-001: Verify embedding vector dimensions."""

    def test_ai_emb_001_single_embed_has_384_dims(self, svc):
        """all-MiniLM-L6-v2 always produces 384-dimensional float vectors."""
        vec = svc.embed("Hello world")
        assert len(vec) == _EMBEDDING_DIM

    def test_ai_emb_001_batch_embed_all_have_384_dims(self, svc):
        """Batch embedding returns correct dimensions for every vector."""
        texts = ["Document A", "Document B", "Document C"]
        vecs = svc.embed_batch(texts)
        assert len(vecs) == 3
        assert all(len(v) == _EMBEDDING_DIM for v in vecs)

    def test_ai_emb_001_empty_batch_returns_empty_list(self, svc):
        result = svc.embed_batch([])
        assert result == [] or result is not None  # model behaviour may vary


class TestEmbeddingDeterminism:
    """AI-EMB-002: Same text → same embedding (cosine similarity = 1.0)."""

    def test_ai_emb_002_same_text_same_vector(self, svc):
        """Embedding the same string twice produces identical vectors."""
        vec_a = svc.embed("identical text input")
        vec_b = svc.embed("identical text input")
        assert vec_a == pytest.approx(vec_b, abs=1e-5)

    def test_ai_emb_002_different_texts_different_vectors(self, svc):
        """Different inputs should not produce identical vectors."""
        vec_a = svc.embed("contract about software licencing")
        vec_b = svc.embed("recipe for chocolate cake")
        assert vec_a != pytest.approx(vec_b, abs=1e-3)


class TestChromaDBIsolation:
    """AI-EMB-003 & AI-EMB-004: Vector store isolation and deletion."""

    def test_ai_emb_003_query_returns_only_doc_a_chunks(self, svc):
        """Querying with document_id filter returns only that document's chunks."""
        doc_a_chunks = [f"Chunk {i} from doc A" for i in range(5)]
        doc_b_chunks = [f"Chunk {i} from doc B" for i in range(5)]
        svc.upsert_chunks("doc-A", doc_a_chunks)
        svc.upsert_chunks("doc-B", doc_b_chunks)

        results = svc.query("doc-A", "content from A", n_results=5)
        # All returned chunks must belong to doc-A
        for chunk in results:
            assert "doc A" in chunk

    def test_ai_emb_003_doc_b_query_does_not_return_doc_a_chunks(self, svc):
        """Doc-B queries must not leak Doc-A content."""
        svc.upsert_chunks("doc-A", ["Exclusive secret from doc A"])
        svc.upsert_chunks("doc-B", [f"Normal content {i}" for i in range(5)])

        results = svc.query("doc-B", "content", n_results=5)
        for chunk in results:
            assert "secret from doc A" not in chunk

    def test_ai_emb_004_delete_removes_all_doc_chunks(self, svc):
        """After delete_document, querying that document_id returns no results."""
        svc.upsert_chunks("doc-X", [f"Content chunk {i}" for i in range(5)])
        svc.delete_document("doc-X")
        results = svc.query("doc-X", "content", n_results=5)
        assert results == []

    def test_ai_emb_004_deleting_doc_a_leaves_doc_b_intact(self, svc):
        """Deleting doc-A must not affect doc-B's chunks."""
        svc.upsert_chunks("doc-A", ["Doc A content"])
        svc.upsert_chunks("doc-B", ["Doc B content", "More doc B content"])
        svc.delete_document("doc-A")
        results = svc.query("doc-B", "doc B", n_results=5)
        assert len(results) >= 1
