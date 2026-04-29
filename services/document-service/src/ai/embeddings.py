"""Lightweight chunk ranking for document RAG.

This implementation avoids local embedding models and ChromaDB entirely.
On Render's 512MB plan, the best option is to use API embeddings when an
`OPENAI_API_KEY` is available and fall back to a deterministic lexical scorer
when it is not.
"""

from __future__ import annotations

import logging
import math
from collections import Counter

from src.ai.chunker import select_chunks
from src.core.config import settings

logger = logging.getLogger(__name__)

_singleton: "EmbeddingService | None" = None


def get_embedding_service() -> "EmbeddingService":
    global _singleton
    if _singleton is None:
        _singleton = EmbeddingService()
    return _singleton


class EmbeddingService:
    def __init__(self) -> None:
        self._available = bool(settings.OPENAI_API_KEY) and settings.EMBEDDING_PROVIDER in {"api", "openai"}
        self._client = None
        if self._available:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    @staticmethod
    def _lexical_score(query: str, chunk: str) -> float:
        query_terms = [token for token in query.lower().split() if token]
        if not query_terms:
            return 0.0

        query_counts = Counter(query_terms)
        chunk_tokens = chunk.lower().split()
        chunk_counts = Counter(chunk_tokens)
        overlap = sum(min(query_counts[token], chunk_counts.get(token, 0)) for token in query_counts)
        if not overlap:
            return 0.0

        return overlap / math.sqrt(len(query_terms) * max(1, len(chunk_tokens)))

    @staticmethod
    def _rank_by_score(query: str, chunks: list[str], scores: list[float], top_n: int) -> list[str]:
        ranked = sorted(range(len(chunks)), key=lambda index: scores[index], reverse=True)
        selected = [chunks[index] for index in ranked[:top_n] if chunks[index].strip()]
        return selected or select_chunks(chunks, n=top_n)

    async def retrieve(self, query: str, chunks: list[str], top_n: int = 4) -> list[str]:
        if not chunks:
            return []

        top_n = max(1, min(top_n, len(chunks)))
        if not self._available or self._client is None:
            scores = [self._lexical_score(query, chunk) for chunk in chunks]
            return self._rank_by_score(query, chunks, scores, top_n)

        try:
            response = await self._client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=[query, *chunks],
            )
            vectors = [item.embedding for item in response.data]
            query_vec = vectors[0]
            chunk_vecs = vectors[1:]
            scores = [_cosine_similarity(query_vec, vector) for vector in chunk_vecs]
            return self._rank_by_score(query, chunks, scores, top_n)
        except Exception as exc:
            logger.warning("Embedding API failed, using lexical fallback: %s", exc)
            scores = [self._lexical_score(query, chunk) for chunk in chunks]
            return self._rank_by_score(query, chunks, scores, top_n)

    async def retrieve_many(self, queries: dict[str, str], chunks: list[str], top_n: int = 4) -> dict[str, list[str]]:
        if not chunks:
            return {key: [] for key in queries}

        top_n = max(1, min(top_n, len(chunks)))
        if not self._available or self._client is None:
            return {
                key: await self.retrieve(query, chunks, top_n=top_n)
                for key, query in queries.items()
            }

        try:
            response = await self._client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=[*queries.values(), *chunks],
            )
            vectors = [item.embedding for item in response.data]
            query_vectors = vectors[: len(queries)]
            chunk_vectors = vectors[len(queries):]
            result: dict[str, list[str]] = {}
            for (key, query_vec) in zip(queries.keys(), query_vectors):
                scores = [_cosine_similarity(query_vec, vector) for vector in chunk_vectors]
                ranked = sorted(range(len(chunks)), key=lambda index: scores[index], reverse=True)
                selected = [chunks[index] for index in ranked[:top_n] if chunks[index].strip()]
                result[key] = selected or select_chunks(chunks, n=top_n)
            return result
        except Exception as exc:
            logger.warning("Batch embedding API failed, using lexical fallback: %s", exc)
            return {
                key: await self.retrieve(query, chunks, top_n=top_n)
                for key, query in queries.items()
            }


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return numerator / (left_norm * right_norm)
