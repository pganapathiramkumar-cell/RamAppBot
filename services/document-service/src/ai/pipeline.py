"""
Full document analysis pipeline — 30-second hard cap with partial results.

Strategy:
  - Single-chunk docs skip embedding entirely (no overhead for small PDFs)
  - Embedding capped at 5s; falls back to positional selection on timeout
  - Each chain runs with a 22s individual timeout
  - asyncio.gather(return_exceptions=True) — if one chain times out or fails,
    the others still complete and partial results are returned
  - Total wall-clock budget: ~28s (upload + extraction handled outside)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from src.ai.chains.extract import EntityExtractionChain
from src.ai.chains.snapshot import DocumentSnapshotChain
from src.ai.chains.summarize import SummarizationChain
from src.ai.chains.workflow import WorkflowGenerationChain
from src.ai.chunker import chunk_text, select_chunks
from src.ai.llm_client import LLMClient
from src.core.exceptions import EmptyDocumentError

logger = logging.getLogger(__name__)

_MAX_CONCURRENT_LLM_CALLS = 4
_EMBED_TIMEOUT  = 5    # seconds — skip embedding if it takes longer
_CHAIN_TIMEOUT  = 22   # seconds per chain — return partial if exceeded
_TOP_K = 10
_TOP_N = 3

_QUERY_SUMMARY  = "executive summary main purpose key findings conclusions overview"
_QUERY_SNAPSHOT = "primary topic main subject entities organizations tools systems concepts"
_QUERY_EXTRACT  = "names people dates deadlines obligations tasks deliverables risks liabilities"
_QUERY_WORKFLOW = "action steps next steps process workflow responsibilities timeline owner"

# ── Partial result defaults ────────────────────────────────────────────────────

def _default_snapshot() -> dict:
    return {
        "primary_topic": "", "secondary_topics": [], "word_count": 0,
        "key_ideas": [], "key_concepts": [], "relationships": [],
        "important_entities": {"tools": [], "systems": [], "metrics": [], "people": [], "organizations": []},
    }

def _default_entities() -> dict:
    return {"names": [], "dates": [], "clauses": [], "tasks": [], "risks": []}

def _default_workflow() -> list:
    return [
        {"step_number": 1, "action": "Review document", "priority": "Medium",
         "description": "Read and understand the document content.", "owner": None, "deadline": None},
    ]


class DocumentAnalysisPipeline:
    """
    30-second budget pipeline:
      1. Chunk text
      2. Embed (skipped for single-chunk docs; 5s timeout otherwise)
      3. All 4 chains in parallel, each with 22s timeout
      4. Return whatever completed — partial results > total failure
    """

    def __init__(self, llm: LLMClient | None = None):
        _llm = llm or LLMClient()
        _sem = asyncio.Semaphore(_MAX_CONCURRENT_LLM_CALLS)
        self._summarize = SummarizationChain(llm=_llm, semaphore=_sem)
        self._snapshot  = DocumentSnapshotChain(llm=_llm, semaphore=_sem)
        self._extract   = EntityExtractionChain(llm=_llm, semaphore=_sem)
        self._workflow  = WorkflowGenerationChain(llm=_llm, semaphore=_sem)

    async def run(self, document_id: str, text: str) -> dict:
        if not text or not text.strip():
            raise EmptyDocumentError()

        # ── Step 1: Chunk ──────────────────────────────────────────────────
        chunks = chunk_text(text)
        logger.info("document=%s  chars=%d  chunks=%d", document_id, len(text), len(chunks))

        # ── Step 2: Retrieve chunks per chain ──────────────────────────────
        # Single-chunk docs: skip embedding overhead, pass chunk directly
        if len(chunks) == 1:
            sum_chunks = snap_chunks = ext_chunks = wf_chunks = chunks
            logger.info("document=%s  single-chunk — skipping embedding", document_id)
        else:
            sum_chunks, snap_chunks, ext_chunks, wf_chunks = await _embed_with_timeout(
                document_id, chunks
            )

        # ── Step 3: All chains in parallel, each with hard timeout ─────────
        raw = await asyncio.gather(
            _with_timeout(self._snapshot.run(text, chunks=snap_chunks), _CHAIN_TIMEOUT, "snapshot"),
            _with_timeout(self._summarize.run(text, chunks=sum_chunks), _CHAIN_TIMEOUT, "summary"),
            _with_timeout(self._extract.run(text, chunks=ext_chunks),   _CHAIN_TIMEOUT, "extract"),
            _with_timeout(self._workflow.run(text, chunks=wf_chunks),   _CHAIN_TIMEOUT, "workflow"),
            return_exceptions=True,
        )

        snapshot = raw[0] if isinstance(raw[0], dict)  else _default_snapshot()
        summary  = raw[1] if isinstance(raw[1], str)   else "Summary unavailable — please retry."
        entities = raw[2] if isinstance(raw[2], dict)  else _default_entities()
        workflow = raw[3] if isinstance(raw[3], list)  else _default_workflow()

        completed = sum(1 for r in raw if not isinstance(r, Exception))
        logger.info("document=%s  chains completed: %d/4", document_id, completed)

        return {
            "snapshot":    snapshot,
            "summary":     summary,
            "entities":    entities,
            "workflow":    workflow,
            "analysed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _with_timeout(coro, seconds: float, name: str):
    """Run a coroutine with a timeout; log and return the exception on failure."""
    try:
        return await asyncio.wait_for(coro, timeout=seconds)
    except asyncio.TimeoutError:
        logger.warning("Chain '%s' timed out after %ss", name, seconds)
        return TimeoutError(f"{name} timed out")
    except Exception as exc:
        logger.warning("Chain '%s' failed: %s", name, exc)
        return exc


async def _embed_with_timeout(document_id: str, chunks: list[str]) -> tuple:
    """
    Embed + retrieve with a 5s budget.
    If embedding takes too long, falls back to positional select_chunks.
    """
    fallback = (
        select_chunks(chunks, n=4),
        select_chunks(chunks, n=4),
        select_chunks(chunks, n=4),
        select_chunks(chunks, n=4),
    )
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_embed_and_retrieve, document_id, chunks),
            timeout=_EMBED_TIMEOUT,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("document=%s  embedding timed out — using positional fallback", document_id)
        return fallback
    except Exception as exc:
        logger.warning("document=%s  embedding error: %s — using fallback", document_id, exc)
        return fallback


def _embed_and_retrieve(document_id: str, chunks: list[str]) -> tuple:
    from src.ai.embeddings import get_embedding_service

    fallback = select_chunks(chunks, n=4)

    try:
        svc = get_embedding_service()
        if not svc._available:
            return fallback, fallback, fallback, fallback

        svc.upsert_chunks(document_id, chunks)

        top_k = min(_TOP_K, len(chunks))
        top_n = min(_TOP_N, len(chunks))

        return (
            svc.retrieve_and_rerank(document_id, _QUERY_SUMMARY,  top_k=top_k, top_n=top_n) or fallback,
            svc.retrieve_and_rerank(document_id, _QUERY_SNAPSHOT, top_k=top_k, top_n=top_n) or fallback,
            svc.retrieve_and_rerank(document_id, _QUERY_EXTRACT,  top_k=top_k, top_n=top_n) or fallback,
            svc.retrieve_and_rerank(document_id, _QUERY_WORKFLOW, top_k=top_k, top_n=top_n) or fallback,
        )
    except Exception as exc:
        logger.warning("Retrieval failed for %s: %s — fallback", document_id, exc)
        return fallback, fallback, fallback, fallback
