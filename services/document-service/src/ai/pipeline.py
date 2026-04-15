"""
Full document analysis pipeline:
  PDF text → Summary + Entity Extraction (parallel) → Mermaid Workflow (from raw text)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from src.ai.chains.extract import EntityExtractionChain
from src.ai.chains.summarize import SummarizationChain
from src.ai.chains.workflow import WorkflowGenerationChain
from src.ai.llm_client import LLMClient
from src.core.exceptions import EmptyDocumentError


class DocumentAnalysisPipeline:
    """
    Three-chain pipeline. Workflow reads the raw document text so the diagram
    reflects the actual content rather than derived generic steps.

    Result shape:
        {
            "summary":        str,
            "entities":       { names, dates, clauses, tasks, risks },
            "workflow":       [],               # step cards removed — visual only
            "mermaid_chart":  str,              # Mermaid TD flowchart
            "analysed_at":    str               # ISO-8601 UTC
        }
    """

    def __init__(self, llm: LLMClient | None = None):
        _llm = llm or LLMClient()
        self._summarize = SummarizationChain(llm=_llm)
        self._extract   = EntityExtractionChain(llm=_llm)
        self._workflow  = WorkflowGenerationChain(llm=_llm)

    async def run(self, document_id: str, text: str) -> dict:
        if not text or not text.strip():
            raise EmptyDocumentError()

        # Summary + entity extraction + mermaid workflow — all three in parallel
        summary, entities, mermaid_chart = await asyncio.gather(
            self._summarize.run(text),
            self._extract.run(text),
            self._workflow.run(text),      # ← document text, not summary
        )

        return {
            "summary":       summary,
            "entities":      entities,
            "workflow":      [],            # step cards removed
            "mermaid_chart": mermaid_chart,
            "analysed_at":   datetime.now(timezone.utc).isoformat(),
        }
