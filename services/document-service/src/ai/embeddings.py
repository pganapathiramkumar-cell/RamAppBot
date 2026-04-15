"""
Embedding service using sentence-transformers (all-MiniLM-L6-v2, 384 dims).
ChromaDB is used as the vector store.
"""

from __future__ import annotations

import chromadb
from sentence_transformers import SentenceTransformer

from src.core.config import settings

_MODEL_NAME = "all-MiniLM-L6-v2"
_EMBEDDING_DIM = 384


class EmbeddingService:
    """
    Wraps sentence-transformers for embedding and ChromaDB for storage/retrieval.
    """

    def __init__(self, persist_path: str | None = None):
        self._model = SentenceTransformer(_MODEL_NAME)
        path = persist_path or settings.CHROMA_PERSIST_PATH
        self._chroma = chromadb.PersistentClient(path=path)
        self._collection = self._chroma.get_or_create_collection("documents")

    # ── Embedding ──────────────────────────────────────────────────────────

    def embed(self, text: str) -> list[float]:
        """Return a single 384-dim embedding vector."""
        return self._model.encode(text).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Return a batch of 384-dim embedding vectors."""
        return self._model.encode(texts).tolist()

    # ── Upsert ─────────────────────────────────────────────────────────────

    def upsert_chunks(self, document_id: str, chunks: list[str]) -> None:
        """Embed and store all chunks for a document."""
        ids = [f"{document_id}::chunk::{i}" for i in range(len(chunks))]
        embeddings = self.embed_batch(chunks)
        metadatas = [{"document_id": document_id, "chunk_index": i} for i in range(len(chunks))]
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )

    # ── Query ──────────────────────────────────────────────────────────────

    def query(self, document_id: str, query_text: str, n_results: int = 5) -> list[str]:
        """Retrieve top-N relevant chunks for a query, filtered to one document."""
        query_embedding = self.embed(query_text)
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where={"document_id": document_id},
        )
        return results["documents"][0] if results["documents"] else []

    # ── Delete ─────────────────────────────────────────────────────────────

    def delete_document(self, document_id: str) -> None:
        """Remove all chunks belonging to a document from the collection."""
        self._collection.delete(where={"document_id": document_id})
