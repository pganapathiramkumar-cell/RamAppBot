"""Analysis service — orchestrates the full AI pipeline for a document."""

import uuid

from src.core.exceptions import AnalysisNotReadyError, DocumentNotFoundError
from src.infrastructure.storage.memory_store import (
    table_insert, table_select, table_update,
)


async def run_ai_pipeline(document_id: str, text: str) -> dict:
    """
    Run the full AI pipeline:  summarize → extract entities → generate workflow.
    Returns a dict with keys: summary, entities, workflow.
    """
    from src.ai.pipeline import DocumentAnalysisPipeline
    pipeline = DocumentAnalysisPipeline()
    return await pipeline.run(document_id=document_id, text=text)


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all text from a PDF using pypdf.
    Returns empty string on any pypdf error so the caller can apply a fallback.
    """
    import io
    try:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError
        reader = PdfReader(io.BytesIO(file_bytes), strict=False)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p.strip() for p in pages if p.strip())
    except Exception:
        return ""


class AnalysisService:
    """Stores and retrieves analysis results."""

    async def get_analysis(self, document_id: str, user_id: str) -> dict:
        """
        Fetch the analysis result for a document.

        Raises:
            DocumentNotFoundError: document doesn't belong to the user
            AnalysisNotReadyError: processing is not yet complete
        """
        docs = table_select("documents", {"id": document_id, "user_id": user_id})
        if not docs:
            raise DocumentNotFoundError(document_id)

        status = docs[0]["status"]
        if status != "done":
            raise AnalysisNotReadyError(document_id, status)

        rows = table_select("analyses", {"document_id": document_id})
        if not rows:
            return {}
        return {**rows[0], "status": "done"}

    async def save_analysis(self, document_id: str, analysis: dict) -> None:
        """Persist a completed analysis result — replaces any prior result for this document."""
        from src.infrastructure.storage.memory_store import table_delete
        table_delete("analyses", {"document_id": document_id})
        table_insert("analyses", {"id": str(uuid.uuid4()), "document_id": document_id, **analysis})

    async def retry_analysis(self, document_id: str, user_id: str) -> dict:
        """Clear any cached analysis and reset document to pending for re-queuing."""
        docs = table_select("documents", {"id": document_id, "user_id": user_id})
        if not docs:
            raise DocumentNotFoundError(document_id)
        from src.infrastructure.storage.memory_store import table_delete
        table_delete("analyses", {"document_id": document_id})
        table_update("documents", {"status": "pending"}, {"id": document_id})
        return {"document_id": document_id, "status": "pending"}
