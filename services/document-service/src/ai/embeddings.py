"""
Lightweight chunk ranking — httpx to OpenAI embeddings API or lexical fallback.

Using httpx directly instead of the openai SDK saves ~60 MB on Render's 512 MB plan.
When OPENAI_API_KEY is unset or EMBEDDING_PROVIDER is not "openai"/"api",
falls back to a deterministic BM25-style lexical scorer with zero RAM overhead.
"""

from __future__ import annotations

import logging
import math
from collections import Counter

import httpx

from src.ai.chunker import select_chunks
from src.core.config import settings

logger = logging.getLogger(__name__)

_singleton: "EmbeddingService | None" = None
_EMBED_TIMEOUT = 10.0


def get_embedding_service() -> "EmbeddingService":
    global _singleton
    if _singleton is None:
        _singleton = EmbeddingService()
    return _singleton


class EmbeddingService:
    def __init__(self) -> None:
        self._available = (
            bool(settings.OPENAI_API_KEY)
            and settings.EMBEDDING_PROVIDER in {"api", "openai"}
        )
        if self._available:
            logger.info(
                "EmbeddingService: OpenAI API embeddings (model=%s)", settings.EMBEDDING_MODEL
            )
        else:
            logger.info("EmbeddingService: lexical fallback (no OPENAI_API_KEY)")

    # ── Lexical scoring ────────────────────────────────────────────────────────

    @staticmethod
    def _lexical_score(query: str, chunk: str) -> float:
        query_terms = [t for t in query.lower().split() if t]
        if not query_terms:
            return 0.0
        q_counts = Counter(query_terms)
        c_counts = Counter(chunk.lower().split())
        overlap = sum(min(q_counts[t], c_counts.get(t, 0)) for t in q_counts)
        if not overlap:
            return 0.0
        return overlap / math.sqrt(len(query_terms) * max(1, len(c_counts)))

    @staticmethod
    def _rank(chunks: list[str], scores: list[float], top_n: int) -> list[str]:
        ranked = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)
        selected = [chunks[i] for i in ranked[:top_n] if chunks[i].strip()]
        return selected or select_chunks(chunks, n=top_n)

    # ── OpenAI Embeddings API (httpx) ──────────────────────────────────────────

    async def _embed_via_api(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=_EMBED_TIMEOUT) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={"model": settings.EMBEDDING_MODEL, "input": texts},
            )
            resp.raise_for_status()
        return [item["embedding"] for item in resp.json()["data"]]

    # ── Public API ─────────────────────────────────────────────────────────────

    async def retrieve(self, query: str, chunks: list[str], top_n: int = 4) -> list[str]:
        if not chunks:
            return []
        top_n = max(1, min(top_n, len(chunks)))

        if not self._available:
            scores = [self._lexical_score(query, c) for c in chunks]
            return self._rank(chunks, scores, top_n)

        try:
            vectors = await self._embed_via_api([query, *chunks])
            q_vec = vectors[0]
            scores = [_cosine(q_vec, v) for v in vectors[1:]]
            return self._rank(chunks, scores, top_n)
        except Exception as exc:
            logger.warning("Embedding API failed, lexical fallback: %s", exc)
            scores = [self._lexical_score(query, c) for c in chunks]
            return self._rank(chunks, scores, top_n)

    async def retrieve_many(
        self, queries: dict[str, str], chunks: list[str], top_n: int = 4
    ) -> dict[str, list[str]]:
        if not chunks:
            return {k: [] for k in queries}
        top_n = max(1, min(top_n, len(chunks)))

        if not self._available:
            return {k: await self.retrieve(q, chunks, top_n) for k, q in queries.items()}

        try:
            all_texts = [*queries.values(), *chunks]
            vectors = await self._embed_via_api(all_texts)
            q_vecs = vectors[: len(queries)]
            c_vecs = vectors[len(queries):]
            result: dict[str, list[str]] = {}
            for (key, _), q_vec in zip(queries.items(), q_vecs):
                scores = [_cosine(q_vec, cv) for cv in c_vecs]
                result[key] = self._rank(chunks, scores, top_n)
            return result
        except Exception as exc:
            logger.warning("Batch embedding failed, lexical fallback: %s", exc)
            return {k: await self.retrieve(q, chunks, top_n) for k, q in queries.items()}


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    nl = math.sqrt(sum(a * a for a in left))
    nr = math.sqrt(sum(b * b for b in right))
    return 0.0 if nl == 0.0 or nr == 0.0 else dot / (nl * nr)
