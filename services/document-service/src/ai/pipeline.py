"""
Full document analysis pipeline:
  PDF text → chunk → embed (sync) → per-chain Top-K retrieval + BM25 rerank → LLM

Retrieval flow per chain:
  1. Embed all chunks into ChromaDB  (blocking, ~1-2s, done once)
  2. Each chain issues its own semantic query
  3. ChromaDB returns Top-10 candidates by cosine similarity
  4. BM25 rescores candidates on keyword overlap
  5. RRF fusion combines both ranks → Top-3 chunks sent to LLM
  6. Fallback: positional select_chunks() if embeddings unavailable
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
_TOP_K   = 10   # candidates retrieved from vector DB per chain
_TOP_N   = 3    # chunks kept after reranking — sent to LLM

# Per-chain semantic queries — used to retrieve the most relevant chunks
_QUERY_SUMMARY  = "executive summary main purpose key findings conclusions overview"
_QUERY_SNAPSHOT = "primary topic main subject entities organizations tools systems concepts"
_QUERY_EXTRACT  = "names people dates deadlines obligations tasks deliverables risks liabilities"
_QUERY_WORKFLOW = "action steps next steps process workflow responsibilities timeline owner"


class DocumentAnalysisPipeline:
    """
    Single-pass RAG pipeline:
      1. Chunk text once
      2. Embed all chunks into ChromaDB (synchronous — needed before retrieval)
      3. Each chain retrieves its own Top-K chunks → BM25 rerank → Top-3 → LLM
      4. All 4 chains run in parallel
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

        # ── Step 2: Embed synchronously (must complete before retrieval) ───
        sum_chunks, snap_chunks, ext_chunks, wf_chunks = await asyncio.to_thread(
            _embed_and_retrieve, document_id, chunks
        )

        # ── Step 3: Run all chains in parallel with retrieved chunks ───────
        snapshot, summary, entities, workflow = await asyncio.gather(
            self._snapshot.run(text, chunks=snap_chunks),
            self._summarize.run(text, chunks=sum_chunks),
            self._extract.run(text, chunks=ext_chunks),
            self._workflow.run(text, chunks=wf_chunks),
        )

        return {
            "snapshot":    snapshot,
            "summary":     summary,
            "entities":    entities,
            "workflow":    workflow,
            "analysed_at": datetime.now(timezone.utc).isoformat(),
        }


def _embed_and_retrieve(document_id: str, chunks: list[str]) -> tuple:
    """
    Runs in a thread (CPU-bound).
    Embeds all chunks, then retrieves the best chunks per chain via
    Top-K vector search + BM25 rerank + RRF fusion.
    Falls back to positional select_chunks() if embeddings unavailable.
    """
    from src.ai.embeddings import EmbeddingService

    fallback = select_chunks(chunks, n=4)

    try:
        svc = EmbeddingService()
        if not svc._available:
            logger.warning("Embeddings unavailable — using positional fallback")
            return fallback, fallback, fallback, fallback

        # Upsert all chunks into ChromaDB
        svc.upsert_chunks(document_id, chunks)

        top_k = min(_TOP_K, len(chunks))
        top_n = min(_TOP_N, len(chunks))

        sum_chunks  = svc.retrieve_and_rerank(document_id, _QUERY_SUMMARY,  top_k=top_k, top_n=top_n) or fallback
        snap_chunks = svc.retrieve_and_rerank(document_id, _QUERY_SNAPSHOT, top_k=top_k, top_n=top_n) or fallback
        ext_chunks  = svc.retrieve_and_rerank(document_id, _QUERY_EXTRACT,  top_k=top_k, top_n=top_n) or fallback
        wf_chunks   = svc.retrieve_and_rerank(document_id, _QUERY_WORKFLOW, top_k=top_k, top_n=top_n) or fallback

        logger.info(
            "document=%s  retrieved chunks — summary:%d  snapshot:%d  extract:%d  workflow:%d",
            document_id, len(sum_chunks), len(snap_chunks), len(ext_chunks), len(wf_chunks),
        )
        return sum_chunks, snap_chunks, ext_chunks, wf_chunks

    except Exception as exc:
        logger.warning("Retrieval failed for %s: %s — using fallback", document_id, exc)
        return fallback, fallback, fallback, fallback
