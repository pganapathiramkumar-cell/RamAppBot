"""
Summarization chain.

Strategy:
  < 4000 tokens  →  Stuffing (single LLM call, full text)
  ≥ 4000 tokens  →  Map-Reduce (chunk → summarise each → reduce to final)

Token estimation: 1 token ≈ 4 characters.
"""

from __future__ import annotations

from src.core.exceptions import EmptyDocumentError

_TOKEN_THRESHOLD = 4000
_CHARS_PER_TOKEN = 4
_CHUNK_SIZE_CHARS = _TOKEN_THRESHOLD * _CHARS_PER_TOKEN   # 16 000 chars

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
    def __init__(self, llm=None):
        if llm is None:
            from src.ai.llm_client import LLMClient
            llm = LLMClient()
        self._llm = llm

    async def run(self, text: str) -> str:
        if not text or not text.strip():
            raise EmptyDocumentError()

        if _estimate_tokens(text) < _TOKEN_THRESHOLD:
            return await self._stuffing_chain(text)
        return await self._map_reduce_chain(text)

    async def _stuffing_chain(self, text: str) -> str:
        resp = await self._llm.ainvoke(text, system=_STUFFING_SYSTEM)
        return resp.content.strip()

    async def _map_reduce_chain(self, text: str) -> str:
        # Map: split into chunks and summarise each
        chunks = [
            text[i: i + _CHUNK_SIZE_CHARS]
            for i in range(0, len(text), _CHUNK_SIZE_CHARS)
        ]
        partial_summaries: list[str] = []
        for chunk in chunks:
            resp = await self._llm.ainvoke(chunk, system=_MAP_SYSTEM)
            partial_summaries.append(resp.content.strip())

        # Reduce: combine partial summaries
        combined = "\n\n".join(
            f"Excerpt {i + 1} summary:\n{s}"
            for i, s in enumerate(partial_summaries)
        )
        resp = await self._llm.ainvoke(combined, system=_REDUCE_SYSTEM)
        return resp.content.strip()
