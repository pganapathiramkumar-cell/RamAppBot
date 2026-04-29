"""
Embedding service — sentence-transformers + ChromaDB.

Retrieval pipeline:
  upsert_chunks()        → embed + store all chunks
  retrieve_and_rerank()  → Top-K vector search → BM25 rescore → RRF fusion → Top-N

RRF (Reciprocal Rank Fusion) combines vector similarity rank and BM25 keyword
rank into a single score without needing a separate neural reranker model.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False
    logger.warning(
        "sentence-transformers or chromadb not installed. "
        "Embedding will be skipped. Run: pip install sentence-transformers chromadb"
    )

try:
    from rank_bm25 import BM25Okapi
    _BM25_AVAILABLE = True
except ImportError:
    _BM25_AVAILABLE = False
    logger.warning("rank_bm25 not installed — BM25 reranking disabled. Run: pip install rank_bm25")


_MODEL_NAME    = "all-MiniLM-L6-v2"
_EMBEDDING_DIM = 384   # all-MiniLM-L6-v2 output dimension — used by tests
_RRF_K         = 60

# ── Singleton ──────────────────────────────────────────────────────────────────
# Model loading takes 15-30s on Render free tier. We load it ONCE at module
# level so every subsequent request reuses the warm model in memory.
_singleton: "EmbeddingService | None" = None


def get_embedding_service() -> "EmbeddingService":
    global _singleton
    if _singleton is None:
        _singleton = EmbeddingService()
    return _singleton


class EmbeddingService:
    """
    Wraps sentence-transformers for embedding and ChromaDB for storage/retrieval.
    All methods are no-ops if dependencies are not installed.
    """

    def __init__(self, persist_path: str | None = None):
        if not _DEPS_AVAILABLE:
            self._available = False
            return

        try:
            self._model = SentenceTransformer(_MODEL_NAME)
            # EphemeralClient — in-memory only, no disk dependency.
            # Render free tier has no persistent disk; PersistentClient would fail silently.
            self._chroma = chromadb.EphemeralClient()
            self._collection = self._chroma.get_or_create_collection("documents")
            self._available = True
        except Exception as exc:
            logger.warning("EmbeddingService init failed: %s — embeddings disabled.", exc)
            self._available = False

    # ── Embedding ──────────────────────────────────────────────────────────

    def embed(self, text: str) -> list[float]:
        if not self._available:
            return []
        return self._model.encode(text).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not self._available:
            return []
        return self._model.encode(texts).tolist()

    # ── Upsert ─────────────────────────────────────────────────────────────

    def upsert_chunks(self, document_id: str, chunks: list[str]) -> None:
        """Embed and store all chunks for a document in ChromaDB."""
        if not self._available or not chunks:
            return
        ids = [f"{document_id}::chunk::{i}" for i in range(len(chunks))]
        embeddings = self.embed_batch(chunks)
        metadatas = [
            {"document_id": document_id, "chunk_index": i}
            for i in range(len(chunks))
        ]
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )
        logger.info("Upserted %d chunks for document %s", len(chunks), document_id)

    # ── Query ──────────────────────────────────────────────────────────────

    def query(self, document_id: str, query_text: str, n_results: int = 5) -> list[str]:
        """Retrieve top-N semantically relevant chunks for a document."""
        if not self._available:
            return []
        try:
            # Guard: ChromaDB errors if n_results > stored count
            count = self._collection.count()
            safe_n = max(1, min(n_results, count))
            query_embedding = self.embed(query_text)
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=safe_n,
                where={"document_id": document_id},
            )
            return results["documents"][0] if results["documents"] else []
        except Exception as exc:
            logger.warning("ChromaDB query failed: %s", exc)
            return []

    # ── Retrieve + Rerank ──────────────────────────────────────────────────

    def retrieve_and_rerank(
        self,
        document_id: str,
        query: str,
        top_k: int = 10,
        top_n: int = 3,
    ) -> list[str]:
        """
        Full retrieval pipeline for one query:
          1. Vector search  → top_k candidates (ChromaDB cosine similarity)
          2. BM25 rescore   → keyword relevance score per candidate
          3. RRF fusion     → combine vector rank + BM25 rank
          4. Return top_n   → best chunks for the LLM

        Falls back to plain vector search if BM25 unavailable.
        """
        if not self._available:
            return []

        candidates = self.query(document_id, query, n_results=top_k)
        if not candidates:
            return []
        if len(candidates) <= top_n:
            return candidates

        if not _BM25_AVAILABLE:
            # No BM25 — return top_n from vector search directly
            return candidates[:top_n]

        # BM25 score — tokenise candidates and query
        tokenised = [doc.lower().split() for doc in candidates]
        bm25 = BM25Okapi(tokenised)
        bm25_scores = bm25.get_scores(query.lower().split())

        # BM25 rank order (highest score = rank 1)
        bm25_order = sorted(range(len(candidates)), key=lambda i: bm25_scores[i], reverse=True)
        bm25_rank  = {idx: rank + 1 for rank, idx in enumerate(bm25_order)}

        # Vector rank is simply the ChromaDB return order (index 0 = most similar)
        vector_rank = {i: i + 1 for i in range(len(candidates))}

        # RRF fusion score — higher is better
        rrf = {
            i: 1 / (_RRF_K + vector_rank[i]) + 1 / (_RRF_K + bm25_rank[i])
            for i in range(len(candidates))
        }
        ranked = sorted(rrf, key=lambda i: rrf[i], reverse=True)
        return [candidates[i] for i in ranked[:top_n]]

    # ── Delete ─────────────────────────────────────────────────────────────

    def delete_document(self, document_id: str) -> None:
        """Remove all chunks for a document from ChromaDB."""
        if not self._available:
            return
        self._collection.delete(where={"document_id": document_id})
        logger.info("Deleted embeddings for document %s", document_id)
