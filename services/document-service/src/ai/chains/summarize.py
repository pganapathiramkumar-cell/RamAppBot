"""
Summarization chain.

Strategy:
  < 3 000 tokens  →  Stuffing    (1 LLM call, full text, max 800 output tokens)
  ≥ 3 000 tokens  →  Map-Reduce  (4 parallel map calls → 1 reduce)

Map calls run in parallel via asyncio.gather so wall-clock time is the same as
1 sequential call. The semaphore limits actual LLM concurrency across all chains.

Token budget per analysis (map-reduce path):
  Map  : 4 calls × ~895 input + 250 output = ~4,580 tokens
  Reduce: 1 call  × ~1,020 input + 800 output = ~1,820 tokens
  Total: ~6,400 tokens for summary (vs ~6,155 before, +245 but higher quality)
"""

from __future__ import annotations

import asyncio
import logging
import re

from src.ai.chunker import chunk_text, select_chunks
from src.core.exceptions import EmptyDocumentError, LLMEmptyCompletionError

logger = logging.getLogger(__name__)

_TOKEN_THRESHOLD = 3_000   # tokens — below this use stuffing
_CHARS_PER_TOKEN = 4
_MAX_MAP_CHUNKS  = 4       # parallel map calls — BM25 pre-selects the best 4 chunks

# ── System prompts — prose output, ≤ 50 instruction tokens each ──────────────

_STUFFING_SYSTEM = (
    "Document analyst. Write 4–6 sentences covering: document type, key parties, "
    "core obligations, achievements, technologies, and dates. "
    "Specific names and facts only. Prose — no bullets, no JSON."
)

_MAP_SYSTEM = (
    "Summarise this document excerpt in 3 sentences covering names, dates, and obligations. "
    "Prose only — no bullets, no JSON, no markdown."
)

_REDUCE_SYSTEM = (
    "Merge these section summaries into one executive summary of 5–7 sentences "
    "covering purpose, parties, obligations, achievements, and timelines. "
    "Use actual names and dates from the text. Prose only — no bullets, no JSON, no markdown."
)


def _estimate_tokens(text: str) -> int:
    return len(text) // _CHARS_PER_TOKEN


def _bm25_extractive_summary(text: str, top_k: int = 3) -> str:
    """
    Emergency fallback — top-k sentences by BM25 relevance.
    Never returns empty; always produces readable output.
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

        token_count = _estimate_tokens(text)
        logger.info("Summarize: %d tokens → %s path",
                    token_count, "stuffing" if token_count < _TOKEN_THRESHOLD else "map-reduce")

        if token_count < _TOKEN_THRESHOLD:
            return await self._stuffing_chain(text)

        resolved_chunks = chunks if chunks is not None else chunk_text(text)
        try:
            return await self._map_reduce_chain(resolved_chunks)
        except LLMEmptyCompletionError:
            logger.warning("Map-reduce empty response — BM25 extractive fallback")
            return _bm25_extractive_summary(text)

    async def _llm_call(self, text: str, system: str, max_tokens: int) -> str:
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
            logger.warning("Stuffing empty response — BM25 extractive fallback")
            return _bm25_extractive_summary(text)

    async def _map_reduce_chain(self, chunks: list[str]) -> str:
        """
        4 map calls in parallel (semaphore caps actual LLM concurrency),
        then 1 reduce. Parallel execution keeps wall time ≈ single call time.
        """
        capped = select_chunks(chunks, n=_MAX_MAP_CHUNKS)

        raw = await asyncio.gather(
            *[self._llm_call(chunk, _MAP_SYSTEM, max_tokens=250) for chunk in capped],
            return_exceptions=True,
        )
        partial = [r for r in raw if isinstance(r, str) and r.strip()]

        if not partial:
            raise LLMEmptyCompletionError()

        combined = "\n\n".join(f"Section {i + 1}:\n{s}" for i, s in enumerate(partial))
        return await self._llm_call(combined, _REDUCE_SYSTEM, max_tokens=800)
