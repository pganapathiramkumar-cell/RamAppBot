"""
Full document analysis pipeline:
  PDF text → chunk once → embed → Summary + Snapshot + Entity Extraction + Workflow

Key design decisions:
  - Text is chunked ONCE here and shared across all chains (no redundant re-chunking).
  - A semaphore caps concurrent LLM calls to avoid rate-limit failures on large docs.
  - Embedding runs in a background thread after analysis — never blocks the response.
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

# Max concurrent LLM calls across all chains — prevents rate-limit failures
# on large documents where every chain fires many chunk calls simultaneously.
_MAX_CONCURRENT_LLM_CALLS = 4


class DocumentAnalysisPipeline:
    """
    Single-pass pipeline:
      1. Chunk text once → shared by all chains
      2. Embed chunks into ChromaDB (background, non-blocking)
      3. Run 4 analysis chains in parallel using the shared chunks

    Result shape:
        {
            "snapshot":    {},
            "summary":     str,
            "entities":    { names, dates, clauses, tasks, risks },
            "workflow":    [ { step_number, action, priority, description, owner, deadline } ],
            "analysed_at": str   # ISO-8601 UTC
        }
    """

    def __init__(self, llm: LLMClient | None = None):
        _llm = llm or LLMClient()
        # Shared semaphore — limits total concurrent LLM calls across all chains
        _sem = asyncio.Semaphore(_MAX_CONCURRENT_LLM_CALLS)
        self._summarize = SummarizationChain(llm=_llm, semaphore=_sem)
        self._snapshot  = DocumentSnapshotChain(llm=_llm, semaphore=_sem)
        self._extract   = EntityExtractionChain(llm=_llm, semaphore=_sem)
        self._workflow  = WorkflowGenerationChain(llm=_llm, semaphore=_sem)

    async def run(self, document_id: str, text: str) -> dict:
        if not text or not text.strip():
            raise EmptyDocumentError()

        # ── Step 1: Chunk once ──────────────────────────────────────────────
        chunks = chunk_text(text)
        logger.info(
            "document=%s  chars=%d  chunks=%d",
            document_id, len(text), len(chunks),
        )

        # ── Step 2: Embed in background (never blocks analysis) ────────────
        asyncio.create_task(_embed_chunks_bg(document_id, chunks))

        # ── Step 3: Select focused chunks per chain ────────────────────────
        # Snapshot/extract/workflow only need 4 representative chunks.
        # Summarize gets all chunks (it has its own map-reduce strategy).
        focused = select_chunks(chunks, n=4)

        # ── Step 4: Run all chains in parallel ────────────────────────────
        snapshot, summary, entities, workflow = await asyncio.gather(
            self._snapshot.run(text, chunks=focused),
            self._summarize.run(text, chunks=chunks),
            self._extract.run(text, chunks=focused),
            self._workflow.run(text, chunks=focused),
        )

        return {
            "snapshot":    snapshot,
            "summary":     summary,
            "entities":    entities,
            "workflow":    workflow,
            "analysed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _embed_chunks_bg(document_id: str, chunks: list[str]) -> None:
    """
    Embed and upsert chunks into ChromaDB.
    Runs in a background task — any failure is logged but never propagates.
    Uses asyncio.to_thread so the CPU-bound encoding doesn't block the event loop.
    """
    try:
        from src.ai.embeddings import EmbeddingService
        svc = EmbeddingService()
        await asyncio.to_thread(svc.upsert_chunks, document_id, chunks)
    except Exception as exc:
        logger.warning("Embedding failed for document %s: %s", document_id, exc)
