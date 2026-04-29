"""
Entity extraction chain — chunk-aware.

Every text chunk is processed independently, then results are merged and
deduplicated so no information is lost in large documents.
"""

from __future__ import annotations

import asyncio
import json

from src.ai.chunker import chunk_text
from src.core.exceptions import ExtractionFailedError

ENTITY_SCHEMA = {
    "type": "object",
    "required": ["names", "dates", "clauses", "tasks", "risks"],
    "properties": {
        "names":   {"type": "array", "items": {"type": "string"}},
        "dates":   {"type": "array", "items": {"type": "string"}},
        "clauses": {"type": "array", "items": {"type": "string"}},
        "tasks":   {"type": "array", "items": {"type": "string"}},
        "risks":   {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}

_EXTRACT_SYSTEM = """You are a document analyst. Extract key information from this document section and return ONLY a JSON object with exactly these keys:

  names   – people, companies, organisations, or roles mentioned
  dates   – dates, deadlines, durations, or time periods
  clauses – key obligations, conditions, or important terms (one clause per item)
  tasks   – specific actions, deliverables, or responsibilities
  risks   – risks, gaps, or issues that need attention

Rules:
- Each item must be SPECIFIC and PRECISE — maximum 12 words per item
- Prefer concrete wording from the text over abstract paraphrases
- tasks must start with a strong action verb and include the object when possible
- dates should include the actual deadline/date string from the text
- clauses should name the obligation or condition, not generic labels like "important clause"
- risks should name the concrete issue or failure mode, not vague warnings
- No full explanatory sentences — use short action phrases or concise noun phrases
- Only include items explicitly present in the text; skip empty categories
- Return ONLY the JSON object, no prose, no markdown fences"""

_MERGE_SYSTEM = """You are a document analyst. Merge extracted entities from multiple document sections into one JSON object with keys: names, dates, clauses, tasks, risks.

Rules:
- Remove duplicates and near-duplicates — keep the shortest, clearest version
- Keep each item under 12 words
- Keep tasks concrete and action-oriented
- Prefer items that contain a document-specific noun, role, date, or deliverable
- Sort by importance — most critical first
- Return ONLY the JSON object, no prose, no markdown fences"""


def _parse_json_block(raw: str) -> dict | None:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None


def _empty_entities() -> dict:
    return {"names": [], "dates": [], "clauses": [], "tasks": [], "risks": []}


class EntityExtractionChain:
    def __init__(self, llm=None, max_retries: int = 3, semaphore=None):
        if llm is None:
            from src.ai.llm_client import LLMClient
            llm = LLMClient()
        self._llm = llm
        self.max_retries = max_retries
        self._sem = semaphore

    async def run(self, text: str, chunks: list[str] | None = None) -> dict:
        # Use pre-computed chunks if provided, otherwise chunk here (fallback)
        chunks = chunks if chunks is not None else chunk_text(text)

        if len(chunks) == 1:
            return await self._extract_single(chunks[0])

        # Parallel extraction across all chunks
        results = await asyncio.gather(
            *[self._extract_single(chunk) for chunk in chunks],
            return_exceptions=True,
        )

        # Filter out failures
        valid = [r for r in results if isinstance(r, dict)]
        if not valid:
            raise ExtractionFailedError("All chunk extractions failed")

        if len(valid) == 1:
            return valid[0]

        return await self._merge(valid)

    async def _extract_single(self, text: str) -> dict:
        for attempt in range(1, self.max_retries + 1):
            if self._sem:
                async with self._sem:
                    resp = await self._llm.ainvoke(text, system=_EXTRACT_SYSTEM, max_tokens=800)
            else:
                resp = await self._llm.ainvoke(text, system=_EXTRACT_SYSTEM, max_tokens=800)
            parsed = _parse_json_block(resp.content)
            if parsed is not None:
                result = _empty_entities()
                for key in result:
                    if isinstance(parsed.get(key), list):
                        result[key] = [str(item) for item in parsed[key] if item]
                return result
            if attempt == self.max_retries:
                raise ExtractionFailedError(f"Failed to parse entity JSON after {self.max_retries} attempts")
        raise ExtractionFailedError()

    async def _merge(self, chunk_results: list[dict]) -> dict:
        """Ask the LLM to deduplicate and consolidate across chunks."""
        combined = json.dumps(chunk_results, indent=2)
        for attempt in range(1, self.max_retries + 1):
            resp = await self._llm.ainvoke(combined, system=_MERGE_SYSTEM, max_tokens=800)
            parsed = _parse_json_block(resp.content)
            if parsed is not None:
                result = _empty_entities()
                for key in result:
                    if isinstance(parsed.get(key), list):
                        result[key] = [str(item) for item in parsed[key] if item]
                return result
            if attempt == self.max_retries:
                # Fallback: naive concatenation + dedup
                merged = _empty_entities()
                for chunk in chunk_results:
                    for key in merged:
                        for item in chunk.get(key, []):
                            if item and item not in merged[key]:
                                merged[key].append(item)
                return merged
        raise ExtractionFailedError()
