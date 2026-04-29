"""
In-memory store for development / testing.

Replaces Supabase in local dev so the service works with zero
external dependencies (no DB, no object storage needed).

Data is stored in module-level dicts, so it persists for the
lifetime of the process (one uvicorn instance).
"""

from __future__ import annotations

import threading
from copy import deepcopy
from typing import Any

_lock = threading.Lock()

# Tables: { table_name: { row_id: row_dict } }
_tables: dict[str, dict[str, dict]] = {
    "documents": {},
    "analyses":  {},
}

# Object storage: { bucket/path: bytes }
_blobs: dict[str, bytes] = {}


# ── Public helpers ─────────────────────────────────────────────────────────────

def table_insert(table: str, row: dict) -> dict:
    with _lock:
        _tables.setdefault(table, {})
        _tables[table][row["id"]] = deepcopy(row)
    return deepcopy(row)


def table_select(table: str, filters: dict[str, Any] | None = None) -> list[dict]:
    with _lock:
        rows = list(_tables.get(table, {}).values())
    if filters:
        for key, val in filters.items():
            rows = [r for r in rows if r.get(key) == val]
    return [deepcopy(r) for r in rows]


def table_update(table: str, updates: dict, filters: dict[str, Any]) -> None:
    with _lock:
        for row in _tables.get(table, {}).values():
            if all(row.get(k) == v for k, v in filters.items()):
                row.update(updates)


def table_delete(table: str, filters: dict[str, Any]) -> None:
    with _lock:
        ids = [
            rid for rid, row in _tables.get(table, {}).items()
            if all(row.get(k) == v for k, v in filters.items())
        ]
        for rid in ids:
            _tables[table].pop(rid, None)


def blob_put(path: str, data: bytes) -> None:
    with _lock:
        _blobs[path] = data


def blob_get(path: str) -> bytes | None:
    with _lock:
        return _blobs.get(path)


def blob_delete(path: str) -> None:
    with _lock:
        _blobs.pop(path, None)


def purge_old_records(max_age_seconds: int = 3600) -> None:
    """Delete documents + analyses older than max_age_seconds to cap memory usage."""
    from datetime import datetime, timezone
    cutoff = datetime.now(timezone.utc).timestamp() - max_age_seconds
    with _lock:
        stale_ids = [
            rid for rid, row in _tables.get("documents", {}).items()
            if datetime.fromisoformat(row.get("created_at", "1970-01-01T00:00:00+00:00")).timestamp() < cutoff
        ]
        for rid in stale_ids:
            doc = _tables["documents"].pop(rid, {})
            _blobs.pop(doc.get("storage_path", ""), None)
        doc_ids = {rid for rid in stale_ids}
        _tables["analyses"] = {
            rid: row for rid, row in _tables.get("analyses", {}).items()
            if row.get("document_id") not in doc_ids
        }
