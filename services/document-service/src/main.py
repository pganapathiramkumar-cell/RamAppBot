"""Document Service — FastAPI Application."""

import gc
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from src.core.config import settings
from src.core.exceptions import (
    AnalysisNotReadyError,
    DocumentNotFoundError,
    EmptyFileError,
    FileTooLargeError,
    InvalidFileTypeError,
    JWTExpiredError,
    JWTInvalidAlgorithmError,
    JWTSignatureError,
)
from src.core.security import decode_token
from src.services.analysis_svc import AnalysisService, extract_text_from_pdf, run_ai_pipeline
from src.services.document_svc import DocumentService
from src.services.file_validator import validate_pdf_header
from src.infrastructure.storage.memory_store import table_update, blob_get, blob_delete, purge_old_records


@asynccontextmanager
async def lifespan(app: FastAPI):
    mode = "DEV (no auth)" if settings.SKIP_AUTH else "PROD"
    print(
        f"[Document Service] Starting — mode: {mode} | "
        f"max upload: {settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB"
    )
    yield
    print("[Document Service] Shutting down")


app = FastAPI(
    title="Rambot Document Service",
    description="PDF upload, RAG analysis: Summary · Action Points · Workflow",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = [origin.strip() for origin in settings.CORS_ALLOW_ORIGINS.split(",") if origin.strip()]
if not _cors_origins:
    _cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth dependency ────────────────────────────────────────────────────────────

_DEV_USER = {"sub": "dev-user-001", "email": "dev@rambot.local"}


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> dict:
    # Development bypass — no token required
    if settings.SKIP_AUTH:
        if not authorization:
            return _DEV_USER
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED"})
    token = authorization.removeprefix("Bearer ")
    try:
        return decode_token(token)
    except JWTExpiredError:
        raise HTTPException(status_code=401, detail={"code": "TOKEN_EXPIRED"})
    except (JWTSignatureError, JWTInvalidAlgorithmError):
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN"})


CurrentUser = Annotated[dict, Depends(get_current_user)]


# ── Background pipeline runner ─────────────────────────────────────────────────

async def _run_pipeline_bg(document_id: str, storage_path: str) -> None:
    """
    Background task: extract text → run AI chains → save results → clean up memory.
    PDF bytes and embeddings are deleted immediately after analysis to free RAM.
    """
    try:
        table_update("documents", {"status": "processing"}, {"id": document_id})

        pdf_path = blob_get(storage_path)
        if not pdf_path:
            raise ValueError("PDF path not found in store")

        text = await extract_text_from_pdf(pdf_path)

        # Free stored PDF immediately after extraction.
        blob_delete(storage_path)

        if not text.strip():
            text = "This PDF appears to be a scanned image or contains no extractable text. Please upload a text-based PDF."

        result = await run_ai_pipeline(document_id=document_id, text=text)

        svc = AnalysisService()
        await svc.save_analysis(document_id, result)

        table_update("documents", {"status": "done"}, {"id": document_id})

        # Purge any records older than 1 hour to cap long-running memory growth
        purge_old_records(max_age_seconds=3600)
        del text
        gc.collect()

    except Exception as exc:
        print(f"[Pipeline] FAILED for {document_id}: {exc}")
        blob_delete(storage_path)   # always free the blob even on failure
        table_update("documents", {"status": "failed"}, {"id": document_id})
        gc.collect()


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    llm_model = {
        "groq": settings.GROQ_MODEL,
        "ollama": settings.OLLAMA_MODEL,
        "nvidia": settings.NVIDIA_MODEL,
        "cerebras": settings.CEREBRAS_MODEL,
    }.get(settings.LLM_PROVIDER, "mock")
    embedding_provider = "openai" if settings.OPENAI_API_KEY and settings.EMBEDDING_PROVIDER in {"api", "openai"} else "lexical"
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "skip_auth": settings.SKIP_AUTH,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": llm_model,
        "embedding_provider": embedding_provider,
    }


# ── Privacy Policy ────────────────────────────────────────────────────────────

_PRIVACY_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy — RamVector</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 760px; margin: 40px auto; padding: 0 24px;
         color: #1e293b; line-height: 1.7; }
  h1 { color: #0f172a; font-size: 28px; margin-bottom: 4px; }
  h2 { color: #0f172a; font-size: 18px; margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  p, li { color: #475569; font-size: 15px; }
  ul { padding-left: 20px; }
  a { color: #2563eb; }
  .meta { color: #94a3b8; font-size: 13px; margin-bottom: 32px; }
  .highlight { background: #f0f9ff; border-left: 3px solid #2563eb;
               padding: 14px 18px; border-radius: 4px; margin: 16px 0; }
</style>
</head>
<body>
<h1>Privacy Policy</h1>
<p class="meta">RamVector &mdash; Last updated: April 29, 2026</p>

  <p>RamVector (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy.
This policy explains what data the RamVector mobile app collects, how it is used, and who it is shared with.</p>

<h2>1. Data We Collect</h2>
<ul>
  <li><strong>PDF document content</strong> &mdash; the text extracted from PDFs you upload.</li>
  <li><strong>Document metadata</strong> &mdash; filename and file size.</li>
  <li><strong>Consent record</strong> &mdash; a session flag indicating you accepted this policy (stored on-device only).</li>
</ul>
<p>We do <strong>not</strong> collect your name, email address, location, device identifiers, or any other personal information.</p>

<h2>2. How We Use Your Data</h2>
<p>Uploaded PDF text is used solely to generate:</p>
<ul>
  <li>An AI-produced executive summary</li>
  <li>Structured action points and key entities</li>
  <li>A workflow diagram</li>
</ul>
<p>Results are returned to you in the app and are not used for advertising, profiling, or any other purpose.</p>

<h2>3. Third-Party AI Service — Groq, Inc.</h2>
<div class="highlight">
  <p><strong>Your PDF text content is transmitted to Groq, Inc.</strong> (groq.com), a third-party AI service,
  to perform the analysis described above. Groq processes this data on our behalf under their own
  <a href="https://groq.com/privacy-policy/" target="_blank">Privacy Policy</a>.</p>
  <p>By using RamVector and accepting this policy, you consent to your document text being sent to Groq for processing.</p>
</div>
<p>When embedding-based retrieval is enabled in production, chunks of your document text may also be sent to OpenAI to compute embeddings for ranking and retrieval.</p>
<p>We do not sell, rent, or share your data with any other third parties.</p>

<h2>4. Data Retention</h2>
<ul>
  <li>Documents are processed in memory and are <strong>not stored permanently</strong> on our servers.</li>
  <li>Analysis results are held temporarily in server memory and are lost when the service restarts.</li>
  <li>Uploaded PDFs are stored on ephemeral disk only long enough for extraction and are deleted immediately after processing.</li>
  <li>Groq's data retention is governed by <a href="https://groq.com/privacy-policy/" target="_blank">Groq's Privacy Policy</a>.</li>
</ul>

<h2>5. Data Security</h2>
<p>All data is transmitted over HTTPS (TLS). We do not log or store the content of your documents beyond the time needed to complete the analysis.</p>

<h2>6. Children's Privacy</h2>
<p>RamVector is not directed at children under 13. We do not knowingly collect data from children.</p>

<h2>7. Your Rights</h2>
<p>Because we do not store personal data permanently, there is no persistent record to delete. You can withdraw consent at any time by uninstalling the app.</p>

<h2>8. Contact Us</h2>
<p>Questions about this policy? Contact us at:
<a href="mailto:ramgigatech@gmail.com">ramgigatech@gmail.com</a></p>

<h2>9. Changes to This Policy</h2>
<p>We may update this policy from time to time. The &ldquo;last updated&rdquo; date at the top will reflect any changes.
Continued use of the app after changes constitutes acceptance of the revised policy.</p>

</body>
</html>"""


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return HTMLResponse(content=_PRIVACY_HTML, status_code=200)


# ── Documents ──────────────────────────────────────────────────────────────────

@app.post("/api/v1/documents/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: CurrentUser = None,
):
    original_name = file.filename or "upload.pdf"
    try:
        file.file.seek(0, os.SEEK_END)
        declared_size = file.file.tell()
        file.file.seek(0)
    except Exception:
        declared_size = 0

    if declared_size == 0:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_FILE", "message": "Uploaded file is empty."})
    if declared_size > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": "Uploaded file exceeds the maximum size limit.",
                "max_size_mb": settings.MAX_FILE_SIZE_BYTES // (1024 * 1024),
            },
        )

    try:
        header = file.file.read(4)
        file.file.seek(0)
        validate_pdf_header(header, original_name, declared_size)
    except EmptyFileError as exc:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_FILE", "message": exc.message})
    except FileTooLargeError as exc:
        raise HTTPException(
            status_code=413,
            detail={"code": "FILE_TOO_LARGE", "message": exc.message, "max_size_mb": exc.max_size_mb},
        )
    except InvalidFileTypeError as exc:
        raise HTTPException(status_code=415, detail={"code": "INVALID_FILE_TYPE", "message": exc.message})

    content = await file.read()
    svc = DocumentService()
    doc = await svc.upload_document(
        user_id=user["sub"],
        file_bytes=content,
        filename=original_name,
        file_size=declared_size,
    )

    # Kick off AI pipeline in the background (non-blocking)
    if doc.get("status") == "pending":
        background_tasks.add_task(_run_pipeline_bg, doc["id"], doc["storage_path"])

    del content
    gc.collect()

    return doc


@app.get("/api/v1/documents")
async def list_documents(user: CurrentUser = None):
    svc = DocumentService()
    docs = await svc.list_documents(user_id=user["sub"])
    return docs          # plain list — frontend expects array


@app.delete("/api/v1/documents/{document_id}", status_code=204)
async def delete_document(document_id: str, user: CurrentUser = None):
    svc = DocumentService()
    deleted = await svc.delete_document(document_id, user_id=user["sub"])
    if not deleted:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN"})


# ── Analyses ───────────────────────────────────────────────────────────────────

@app.get("/api/v1/analyses/{document_id}")
async def get_analysis(document_id: str, user: CurrentUser = None):
    svc = AnalysisService()
    try:
        return await svc.get_analysis(document_id, user_id=user["sub"])
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": exc.message})
    except AnalysisNotReadyError as exc:
        # Return 200 with status so the frontend can poll cleanly
        return {"document_id": document_id, "status": exc.current_status}


@app.post("/api/v1/analyses/{document_id}/retry")
async def retry_analysis(
    document_id: str,
    background_tasks: BackgroundTasks,
    user: CurrentUser = None,
):
    svc = AnalysisService()
    try:
        result = await svc.retry_analysis(document_id, user_id=user["sub"])
        # Re-run pipeline
        from src.infrastructure.storage.memory_store import table_select
        docs = table_select("documents", {"id": document_id})
        if docs:
            background_tasks.add_task(_run_pipeline_bg, document_id, docs[0]["storage_path"])
        return result
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": exc.message})
