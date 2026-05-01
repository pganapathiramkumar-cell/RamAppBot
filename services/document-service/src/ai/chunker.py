"""
Text chunker — splits extracted PDF text into overlapping semantic chunks
for parallel LLM processing.

Strategy:
  - Clean text first (strip page numbers, headers, excessive whitespace)
  - Chunk size  : ~875 tokens  (≈ 3500 chars) — focused, less waste
  - Overlap     : ~75  tokens  (≈  300 chars) — enough context at edges
  - Min chunk   : 200 chars — discard tiny trailing fragments
  - Hard cap    : MAX_CHUNKS total — prevents runaway token usage on large docs
  - BM25 selection — rank chunks by query relevance (rank_bm25, pure Python)
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

_CHUNK_CHARS     = 3_500
_OVERLAP_CHARS   = 300
_MIN_CHUNK_CHARS = 200
MAX_CHUNKS       = 8  # hard cap — never send more than 8 chunks to the LLM


# ── Text cleaner ───────────────────────────────────────────────────────────────

_PAGE_NUM  = re.compile(r'(?m)^\s*(?:Page\s+)?\d+\s*(?:of\s+\d+)?\s*$')
_HEADER_HR = re.compile(r'[-=]{4,}')
_MULTI_NL  = re.compile(r'\n{3,}')
_MULTI_SP  = re.compile(r'[ \t]{2,}')


_HYPHEN_BREAK = re.compile(r'(\w)-\n(\w)')  # fix hyphenated line-breaks from PDF extraction


def clean_text(text: str) -> str:
    """Strip PDF noise: page numbers, horizontal rules, redundant whitespace."""
    text = _HYPHEN_BREAK.sub(r'\1\2', text)   # rejoin split words
    text = _PAGE_NUM.sub('', text)
    text = _HEADER_HR.sub('', text)
    text = _MULTI_SP.sub(' ', text)
    text = _MULTI_NL.sub('\n\n', text)
    return text.strip()


# ── Chunk selection ────────────────────────────────────────────────────────────

def select_chunks(chunks: list[str], n: int = 4) -> list[str]:
    """
    Pick the n most representative chunks without embeddings.
    Always includes first and last; fills the middle with evenly-spaced picks.
    Used by chains that need focused context, not every chunk.
    """
    if len(chunks) <= n:
        return chunks
    if n <= 1:
        return [chunks[0]]
    middle_n = n - 2
    middle = chunks[1:-1]
    if not middle or middle_n <= 0:
        return [chunks[0], chunks[-1]]
    step = max(1, len(middle) // middle_n)
    sampled = middle[::step][:middle_n]
    return [chunks[0]] + sampled + [chunks[-1]]


# ── Paragraph splitter ─────────────────────────────────────────────────────────

def _split_paragraphs(text: str) -> list[str]:
    paras = re.split(r'\n{2,}', text)
    result: list[str] = []
    for para in paras:
        para = para.strip()
        if not para:
            continue
        if len(para) > _CHUNK_CHARS:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            result.extend(s.strip() for s in sentences if s.strip())
        else:
            result.append(para)
    return result


# ── Main entry point ───────────────────────────────────────────────────────────

def chunk_text(text: str) -> list[str]:
    """
    Clean and chunk text. Returns at most MAX_CHUNKS chunks.
    If the document produces more, keeps first 2 + evenly-spaced middle + last 2.
    """
    text = clean_text(text)

    if len(text) <= _CHUNK_CHARS:
        return [text]

    units = _split_paragraphs(text)
    chunks: list[str] = []
    current = ""

    for unit in units:
        if current and len(current) + len(unit) + 1 > _CHUNK_CHARS:
            if len(current) >= _MIN_CHUNK_CHARS:
                chunks.append(current.strip())
            overlap_buf = current[-_OVERLAP_CHARS:] if len(current) > _OVERLAP_CHARS else current
            current = overlap_buf + "\n\n" + unit
        else:
            current = (current + "\n\n" + unit).strip() if current else unit

    if current.strip() and len(current.strip()) >= _MIN_CHUNK_CHARS:
        chunks.append(current.strip())

    raw = chunks or [text[:_CHUNK_CHARS]]

    # Hard cap — keep first 2 + evenly-spaced middle + last 2
    if len(raw) > MAX_CHUNKS:
        head = raw[:2]
        tail = raw[-2:]
        mid_n = MAX_CHUNKS - 4
        mid = raw[2:-2]
        step = max(1, len(mid) // mid_n) if mid_n > 0 else 1
        raw = head + mid[::step][:mid_n] + tail

    return raw


def bm25_select_chunks(chunks: list[str], query: str, top_k: int = 4) -> list[str]:
    """
    Rank chunks by BM25 relevance to query and return top-k.

    Falls back to positional select_chunks if rank_bm25 is unavailable.
    Preserves document order in the returned subset.
    """
    if len(chunks) <= top_k:
        return chunks
    try:
        from rank_bm25 import BM25Okapi
        tokenized = [c.lower().split() for c in chunks]
        bm25 = BM25Okapi(tokenized)
        scores = bm25.get_scores(query.lower().split())
        top_indices = sorted(
            range(len(scores)), key=lambda i: scores[i], reverse=True
        )[:top_k]
        return [chunks[i] for i in sorted(top_indices)]
    except Exception as exc:
        logger.warning("bm25_select_chunks fallback to positional: %s", exc)
        return select_chunks(chunks, n=top_k)
