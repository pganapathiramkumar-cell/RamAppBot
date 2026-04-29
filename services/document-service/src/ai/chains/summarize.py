"""
Summarization chain.

Strategy:
  < 4000 tokens  →  Stuffing (single LLM call, full text)
  ≥ 4000 tokens  →  Map-Reduce (chunk → summarise each → reduce to final)

Token estimation: 1 token ≈ 4 characters.
"""

from __future__ import annotations

from src.ai.chunker import chunk_text
from src.core.exceptions import EmptyDocumentError

_TOKEN_THRESHOLD  = 3_000   # chars — below this, single stuffing call
_CHARS_PER_TOKEN  = 4
_MAX_MAP_CHUNKS   = 5       # cap map-reduce to 5 chunks max (≈5 LLM calls → reduce)

_STUFFING_SYSTEM = (
    "You are a senior document analyst. Write a detailed, structured summary of the document below. "
    "Your summary must cover ALL of the following in flowing paragraphs (not bullet points):\n"
    "1. Document type and overall purpose\n"
    "2. Key parties, people, or organisations involved\n"
    "3. Core obligations, responsibilities, or qualifications\n"
    "4. Important achievements, milestones, or deliverables\n"
    "5. Key skills, technologies, or domain expertise mentioned\n"
    "6. Notable dates, timelines, or deadlines\n"
    "7. Recommendations or next steps (if any)\n"
    "Write 4–6 detailed sentences. Be specific — include actual names, dates, and facts from the document."
)

_MAP_SYSTEM = (
    "Summarise the following document excerpt in 3–4 sentences. "
    "Include specific names, dates, facts, and key obligations mentioned."
)

_REDUCE_SYSTEM = (
    "You are a senior document analyst. Combine the partial summaries below into a single, "
    "detailed executive summary (5–7 sentences). Cover: document purpose, key parties, "
    "core obligations, achievements, skills/technologies, and timelines. "
    "Be specific — use the actual names, dates, and facts from the summaries."
)


def _estimate_tokens(text: str) -> int:
    return len(text) // _CHARS_PER_TOKEN


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

        # Use pre-computed chunks if provided, otherwise fall back to own chunking
        resolved_chunks = chunks if chunks is not None else chunk_text(text)
        return await self._map_reduce_chain(resolved_chunks)

    async def _llm_call(self, text: str, system: str, max_tokens: int = 1024) -> str:
        if self._sem:
            async with self._sem:
                resp = await self._llm.ainvoke(text, system=system, max_tokens=max_tokens)
        else:
            resp = await self._llm.ainvoke(text, system=system, max_tokens=max_tokens)
        return resp.content.strip()

    async def _stuffing_chain(self, text: str) -> str:
        return await self._llm_call(text, _STUFFING_SYSTEM, max_tokens=1500)

    async def _map_reduce_chain(self, chunks: list[str]) -> str:
        # Cap chunks to avoid runaway LLM calls on very large documents
        from src.ai.chunker import select_chunks
        capped = select_chunks(chunks, n=_MAX_MAP_CHUNKS)

        # Map: summarise each chunk sequentially to respect rate limits
        partial_summaries: list[str] = []
        for chunk in capped:
            summary = await self._llm_call(chunk, _MAP_SYSTEM, max_tokens=512)
            partial_summaries.append(summary)

        # Reduce: combine partial summaries into final
        combined = "\n\n".join(
            f"Excerpt {i + 1} summary:\n{s}"
            for i, s in enumerate(partial_summaries)
        )
        return await self._llm_call(combined, _REDUCE_SYSTEM, max_tokens=1500)
