"""Document Service — FastAPI Application."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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
from src.services.file_validator import validate_pdf
from src.infrastructure.storage.memory_store import table_update, blob_get


@asynccontextmanager
async def lifespan(app: FastAPI):
    mode = "DEV (no auth)" if settings.SKIP_AUTH else "PROD"
    print(f"[Document Service] Starting — mode: {mode} | max upload: {settings.MAX_FILE_SIZE_BYTES // (1024*1024)} MB")
    yield
    print("[Document Service] Shutting down")


app = FastAPI(
    title="Rambot Document Service",
    description="PDF upload, RAG analysis: Summary · Action Points · Workflow",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    Background task: extract text from stored PDF → run AI chains → save results.
    Runs after the upload response has already been sent to the client.
    """
    try:
        # Mark as processing
        table_update("documents", {"status": "processing"}, {"id": document_id})

        # Extract text from stored PDF bytes
        pdf_bytes = blob_get(storage_path)
        if not pdf_bytes:
            raise ValueError("PDF bytes not found in store")

        text = await extract_text_from_pdf(pdf_bytes)
        if not text.strip():
            # Scanned / image-only PDF — return a helpful message instead of failing
            text = "This PDF appears to be a scanned image or contains no extractable text. Please upload a text-based PDF."

        # Run all 3 AI chains
        result = await run_ai_pipeline(document_id=document_id, text=text)

        # Persist analysis
        svc = AnalysisService()
        await svc.save_analysis(document_id, result)

        # Mark as done
        table_update("documents", {"status": "done"}, {"id": document_id})

    except Exception as exc:
        print(f"[Pipeline] FAILED for {document_id}: {exc}")
        table_update("documents", {"status": "failed"}, {"id": document_id})


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": settings.SERVICE_NAME,
        "skip_auth": settings.SKIP_AUTH,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.GROQ_MODEL if settings.LLM_PROVIDER == "groq" else settings.OLLAMA_MODEL,
    }


# ── Documents ──────────────────────────────────────────────────────────────────

@app.post("/api/v1/documents/upload", status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: CurrentUser = None,
):
    content = await file.read()
    try:
        validate_pdf(content, file.filename or "upload.pdf", len(content))
    except EmptyFileError as exc:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_FILE", "message": exc.message})
    except FileTooLargeError as exc:
        raise HTTPException(
            status_code=413,
            detail={"code": "FILE_TOO_LARGE", "message": exc.message, "max_size_mb": exc.max_size_mb},
        )
    except InvalidFileTypeError as exc:
        raise HTTPException(status_code=415, detail={"code": "INVALID_FILE_TYPE", "message": exc.message})

    svc = DocumentService()
    doc = await svc.upload_document(
        user_id=user["sub"],
        file_bytes=content,
        filename=file.filename or "upload.pdf",
        file_size=len(content),
    )

    # Kick off AI pipeline in the background (non-blocking)
    if doc.get("status") == "pending":
        background_tasks.add_task(_run_pipeline_bg, doc["id"], doc["storage_path"])

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
