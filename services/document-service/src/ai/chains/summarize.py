"""
Summarization chain.

Strategy:
  < 3000 tokens  →  Stuffing (single LLM call, full text)
  ≥ 3000 tokens  →  Map-Reduce (chunk → summarise each → reduce to final)

Token estimation: 1 token ≈ 4 characters.
Prompts are kept compact: ≤ 50 instruction tokens each to maximise content budget.
"""

from __future__ import annotations

import logging
import re

from src.ai.chunker import chunk_text
from src.core.exceptions import EmptyDocumentError, LLMEmptyCompletionError

logger = logging.getLogger(__name__)

_TOKEN_THRESHOLD  = 3_000
_CHARS_PER_TOKEN  = 4
_MAX_MAP_CHUNKS   = 3   # 3 map calls → reduce keeps summary under 15s on free tier

# ── Compact system prompts — trimmed to ≤50 instruction tokens each ───────────

_STUFFING_SYSTEM = (
    "Document analyst. Write 4–6 sentences covering: document type, key parties, "
    "core obligations, achievements, technologies, and dates. "
    "Use specific names and facts from the text. Prose only, no bullets."
)

_MAP_SYSTEM = (
    "Summarise this document excerpt in 3 sentences. "
    "Include names, dates, and key obligations. Output JSON only, no prose, no markdown fences."
)

_REDUCE_SYSTEM = (
    "Merge these partial summaries into one executive summary (5–7 sentences) "
    "covering purpose, parties, obligations, achievements, and timelines. "
    "Use actual names and dates from the summaries. Output JSON only, no prose, no markdown fences."
)


def _estimate_tokens(text: str) -> int:
    return len(text) // _CHARS_PER_TOKEN


def _bm25_extractive_summary(text: str, top_k: int = 3) -> str:
    """
    Emergency fallback: extract top-k sentences by BM25 relevance.
    Never returns an empty string — always produces human-readable output.
    """
    try:
        from rank_bm25 import BM25Okapi
        query_terms = "executive summary purpose key findings conclusions obligations".split()
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if len(s.strip()) > 30]
        if not sentences:
            return (text[:500].strip() or "Document processed successfully.").rstrip(".,") + "."
        tokenized = [s.lower().split() for s in sentences]
        bm25 = BM25Okapi(tokenized)
        scores = bm25.get_scores(query_terms)
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
        return " ".join(sentences[i] for i in sorted(top_indices))
    except Exception as exc:
        logger.warning("BM25 extractive fallback error: %s", exc)
        return (text[:500].strip() or "Document processed successfully.").rstrip(".,") + "."


class SummarizationChain:
    def __init__(self, llm=None, semaphore=None):
        if llm is None:
            from src.ai.llm_client import LLMClient
            llm = LLMClient()
        self._llm = llm
        self._sem = semaphore

    async def run(self, text: str, chunks: list[str] | None = None) -> str:
        if not text or not text.strip():
            raise EmptyDocumentError()

        if _estimate_tokens(text) < _TOKEN_THRESHOLD:
            return await self._stuffing_chain(text)

        resolved_chunks = chunks if chunks is not None else chunk_text(text)
        try:
            return await self._map_reduce_chain(resolved_chunks)
        except LLMEmptyCompletionError:
            logger.warning("Map-reduce got empty LLM response — using extractive fallback")
            return _bm25_extractive_summary(text)

    async def _llm_call(self, text: str, system: str, max_tokens: int = 1024) -> str:
        if self._sem:
            async with self._sem:
                resp = await self._llm.ainvoke(text, system=system, max_tokens=max_tokens)
        else:
            resp = await self._llm.ainvoke(text, system=system, max_tokens=max_tokens)
        content = resp.content.strip()
        if not content:
            raise LLMEmptyCompletionError()
        return content

    async def _stuffing_chain(self, text: str) -> str:
        try:
            return await self._llm_call(text, _STUFFING_SYSTEM, max_tokens=800)
        except LLMEmptyCompletionError:
            logger.warning("Stuffing got empty LLM response — using extractive fallback")
            return _bm25_extractive_summary(text)

    async def _map_reduce_chain(self, chunks: list[str]) -> str:
        from src.ai.chunker import select_chunks
        capped = select_chunks(chunks, n=_MAX_MAP_CHUNKS)

        partial_summaries: list[str] = []
        for chunk in capped:
            summary = await self._llm_call(chunk, _MAP_SYSTEM, max_tokens=400)
            partial_summaries.append(summary)

        combined = "\n\n".join(
            f"Excerpt {i + 1}:\n{s}"
            for i, s in enumerate(partial_summaries)
        )
        return await self._llm_call(combined, _REDUCE_SYSTEM, max_tokens=1000)
