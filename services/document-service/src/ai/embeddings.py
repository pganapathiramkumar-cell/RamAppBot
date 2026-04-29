"""
Embedding service — sentence-transformers + ChromaDB.
Imported lazily so the app starts even if the packages are not installed.
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


_MODEL_NAME = "all-MiniLM-L6-v2"


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
        query_embedding = self.embed(query_text)
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where={"document_id": document_id},
        )
        return results["documents"][0] if results["documents"] else []

    # ── Delete ─────────────────────────────────────────────────────────────

    def delete_document(self, document_id: str) -> None:
        """Remove all chunks for a document from ChromaDB."""
        if not self._available:
            return
        self._collection.delete(where={"document_id": document_id})
        logger.info("Deleted embeddings for document %s", document_id)
