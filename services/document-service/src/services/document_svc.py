"""Document CRUD and storage orchestration."""

import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from src.infrastructure.storage.memory_store import (
    blob_put, table_delete, table_insert, table_select, table_update,
)


class DocumentService:
    """
    Handles document lifecycle: upload → deduplicate → persist → queue analysis.
    Backed by the in-memory store for local dev; swap for Supabase in production.
    """

    # ── Upload ──────────────────────────────────────────────────────────────────

    async def upload_document(
        self,
        user_id: str,
        file_bytes: bytes,
        filename: str,
        file_size: int,
    ) -> dict:
        """
        Upload a document. Returns existing record if content was already seen
        (SHA-256 content-hash deduplication).
        """
        user_id = user_id.replace("\\", "_").replace("/", "_")
        filename = Path(filename).name or "upload.pdf"
        content_hash = hashlib.sha256(file_bytes).hexdigest()

        # Deduplication: same content already uploaded by this user?
        existing = table_select("documents", {"content_hash": content_hash, "user_id": user_id})
        if existing:
            return existing[0]

        # Persist file bytes in blob store
        storage_path = f"{user_id}/{content_hash}/{filename}"
        blob_put(storage_path, file_bytes)

        # Create DB record
        record = {
            "id":           str(uuid.uuid4()),
            "user_id":      user_id,
            "filename":     filename,
            "file_size":    file_size,
            "content_hash": content_hash,
            "status":       "pending",
            "storage_path": storage_path,
            "created_at":   datetime.now(timezone.utc).isoformat(),
        }
        return table_insert("documents", record)

    # ── Status ──────────────────────────────────────────────────────────────────

    async def update_status(self, document_id: str, status: str) -> None:
        table_update("documents", {"status": status}, {"id": document_id})

    # ── Query ───────────────────────────────────────────────────────────────────

    async def get_document(self, document_id: str, user_id: str) -> Optional[dict]:
        rows = table_select("documents", {"id": document_id, "user_id": user_id})
        return rows[0] if rows else None

    async def list_documents(self, user_id: str) -> list[dict]:
        rows = table_select("documents", {"user_id": user_id})
        return sorted(rows, key=lambda r: r.get("created_at", ""), reverse=True)

    async def delete_document(self, document_id: str, user_id: str) -> bool:
        doc = await self.get_document(document_id, user_id)
        if doc is None:
            return False
        table_delete("documents", {"id": document_id})
        table_delete("analyses",  {"document_id": document_id})
        return True
