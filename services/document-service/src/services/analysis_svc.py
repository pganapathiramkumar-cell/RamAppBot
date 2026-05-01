"""Analysis service — orchestrates the full AI pipeline for a document."""

import logging
from pathlib import Path
import uuid

from src.core.exceptions import AnalysisNotReadyError, DocumentNotFoundError, PDFParseError
from src.infrastructure.storage.memory_store import (
    table_insert, table_select, table_update,
)

logger = logging.getLogger(__name__)


async def run_ai_pipeline(document_id: str, text: str) -> dict:
    """
    Run the full AI pipeline:  summarize → extract entities → generate workflow.
    Returns a dict with keys: summary, entities, workflow.
    """
    from src.ai.pipeline import DocumentAnalysisPipeline
    pipeline = DocumentAnalysisPipeline()
    return await pipeline.run(document_id=document_id, text=text)


async def extract_text_from_pdf(file_source: bytes | str | Path) -> str:
    """
    Extract text from a PDF page by page using pypdf.

    Accepts either an in-memory byte string or a filesystem path.
    Returns empty string for genuinely empty/scanned PDFs.
    Raises PDFParseError only on hard library/IO failures.
    """
    try:
        from pypdf import PdfReader
        if isinstance(file_source, (str, Path)):
            pdf_path = Path(file_source)
            if not pdf_path.exists():
                logger.warning("PDF path does not exist: %s", pdf_path)
                return ""
            with pdf_path.open("rb") as handle:
                reader = PdfReader(handle, strict=False)
                pages: list[str] = []
                for page in reader.pages:
                    text = page.extract_text() or ""
                    if text.strip():
                        pages.append(text.strip())
                extracted = "\n\n".join(pages)
                logger.info("PDF extraction: %d pages, %d chars extracted from %s",
                            len(reader.pages), len(extracted), pdf_path.name)
                return extracted

        import io
        reader = PdfReader(io.BytesIO(file_source), strict=False)
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text.strip())
        extracted = "\n\n".join(pages)
        logger.info("PDF extraction (bytes): %d pages, %d chars extracted", len(reader.pages), len(extracted))
        return extracted

    except PDFParseError:
        raise
    except Exception as exc:
        logger.exception("PDF text extraction failed: %s", exc)
        raise PDFParseError() from exc


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
