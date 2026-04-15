"""
Text chunker — splits extracted PDF text into overlapping semantic chunks
for parallel LLM processing.

Strategy:
  - Prefer splitting at paragraph / sentence boundaries
  - Chunk size  : ~2000 tokens  (≈ 8000 chars)
  - Overlap     : ~200  tokens  (≈  800 chars) so context isn't lost at edges
  - Min chunk   : 300 chars — discard tiny trailing fragments
"""

from __future__ import annotations

import re

_CHUNK_CHARS = 8_000
_OVERLAP_CHARS = 800
_MIN_CHUNK_CHARS = 300


def _split_paragraphs(text: str) -> list[str]:
    """Split on blank lines, then on sentence boundaries as fallback."""
    paras = re.split(r'\n{2,}', text)
    result: list[str] = []
    for para in paras:
        para = para.strip()
        if not para:
            continue
        # If a paragraph is itself very long, split on sentence boundaries
        if len(para) > _CHUNK_CHARS:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            result.extend(s.strip() for s in sentences if s.strip())
        else:
            result.append(para)
    return result


def chunk_text(text: str) -> list[str]:
    """
    Return a list of overlapping text chunks suitable for LLM calls.
    Each chunk fits comfortably within an 8k-token context window.
    """
    if len(text) <= _CHUNK_CHARS:
        return [text]

    units = _split_paragraphs(text)
    chunks: list[str] = []
    current = ""
    overlap_buf = ""

    for unit in units:
        # If adding this unit would exceed the chunk size, finalise current chunk
        if current and len(current) + len(unit) + 1 > _CHUNK_CHARS:
            if len(current) >= _MIN_CHUNK_CHARS:
                chunks.append(current.strip())
            # Start new chunk with overlap from end of previous
            overlap_buf = current[-_OVERLAP_CHARS:] if len(current) > _OVERLAP_CHARS else current
            current = overlap_buf + "\n\n" + unit
        else:
            current = (current + "\n\n" + unit).strip() if current else unit

    if current.strip() and len(current.strip()) >= _MIN_CHUNK_CHARS:
        chunks.append(current.strip())

    return chunks or [text[:_CHUNK_CHARS]]
