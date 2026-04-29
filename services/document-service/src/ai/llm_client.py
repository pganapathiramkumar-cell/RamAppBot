"""
LLM client — pure httpx calls to OpenAI-compatible REST APIs.

Replacing the openai + groq SDKs with direct httpx saves ~100 MB on Render's
512 MB plan. All three provider APIs share the same OpenAI-compatible JSON
schema, so a single generic caller covers all of them.

Fallback order: Groq → NVIDIA NIM → Cerebras → Mock
"""

from __future__ import annotations

import json
import re
from collections import Counter

import httpx

from src.core.config import settings

_REQUEST_TIMEOUT = 30.0
_RATE_LIMIT_CODES = {429, 529}


class LLMResponse:
    def __init__(self, content: str):
        self.content = content


class RateLimitError(Exception):
    """Raised on 429/529 so the fallback chain can continue."""


# ── Smart mock (no API, regex + heuristics) ───────────────────────────────────

def _sentences(text: str, n: int = 5) -> list[str]:
    raw = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in raw if len(s.strip()) > 20][:n]


def _mock_summary(text: str) -> str:
    sents = _sentences(text, 4)
    if not sents:
        return "This document contains limited extractable text."
    body = " ".join(sents)
    return body[:600].rsplit(" ", 1)[0] + "…" if len(body) > 600 else body


def _mock_entities(text: str) -> str:
    date_pat = re.compile(
        r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2}|'
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|'
        r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b',
        re.I,
    )
    dates = list(dict.fromkeys(date_pat.findall(text)))[:6]
    name_pat = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')
    freq = Counter(name_pat.findall(text))
    names = [n for n, _ in freq.most_common(8) if len(n) > 3][:6]
    clause_kw = re.compile(r'\b(clause|provision|agreement|terms?|conditions?|liability|obligation|warranty|indemnif|termination)\b', re.I)
    task_kw   = re.compile(r'\b(shall|must|will|should|required to|responsible for|needs? to|ensure)\b', re.I)
    risk_kw   = re.compile(r'\b(risk|liability|penalty|breach|violat|fail|damage|loss|dispute|delay)\b', re.I)
    clauses: list[str] = []
    tasks: list[str]   = []
    risks: list[str]   = []
    for s in _sentences(text, 30):
        if clause_kw.search(s) and s[:100] not in clauses:
            clauses.append(s[:100])
        if task_kw.search(s) and s[:100] not in tasks:
            tasks.append(s[:100])
        if risk_kw.search(s) and s[:100] not in risks:
            risks.append(s[:100])
        if len(clauses) >= 4 and len(tasks) >= 5 and len(risks) >= 4:
            break
    return json.dumps({
        "names":   names   or ["(none identified)"],
        "dates":   dates   or ["(none identified)"],
        "clauses": clauses[:4] or ["(none identified)"],
        "tasks":   tasks[:5]   or ["(none identified)"],
        "risks":   risks[:4]   or ["(none identified)"],
    })


def _smart_mock(system: str, prompt: str) -> str:
    s = system.lower()
    if "primary_topic" in s and "important_entities" in s and "relationships" in s:
        return json.dumps({
            "primary_topic": "document overview",
            "secondary_topics": ["key points", "entities", "workflow"],
            "key_ideas": _sentences(prompt, 4),
            "important_entities": {
                "tools": [], "systems": [], "metrics": [], "people": [], "organizations": [],
            },
            "relationships": [],
            "key_concepts": ["document", "summary"],
        })
    if "names" in s and "dates" in s:
        return _mock_entities(prompt)
    return _mock_summary(prompt)


# ── Generic OpenAI-compatible caller ─────────────────────────────────────────

async def _call_openai_compat(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    max_tokens: int,
) -> str:
    """POST to any OpenAI-compatible /chat/completions endpoint via httpx."""
    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        resp = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.1,
                "max_tokens": max_tokens,
            },
        )
    if resp.status_code in _RATE_LIMIT_CODES:
        raise RateLimitError(f"Rate limited {resp.status_code}: {resp.text[:200]}")
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"] or ""


async def _call_groq(messages: list[dict], model: str, max_tokens: int) -> str:
    return await _call_openai_compat(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.GROQ_API_KEY,
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )


async def _call_nvidia(messages: list[dict], model: str, max_tokens: int) -> str:
    return await _call_openai_compat(
        base_url=settings.NVIDIA_BASE_URL,
        api_key=settings.NVIDIA_API_KEY,
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )


async def _call_cerebras(messages: list[dict], model: str, max_tokens: int) -> str:
    return await _call_openai_compat(
        base_url="https://api.cerebras.ai/v1",
        api_key=settings.CEREBRAS_API_KEY,
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )


# ── LLM Client ────────────────────────────────────────────────────────────────

class LLMClient:
    """
    Async LLM client — direct httpx calls, no SDK packages.
    Saves ~100 MB vs. importing openai + groq on Render's 512 MB plan.
    Fallback order: Groq → NVIDIA NIM → Cerebras → Mock
    """

    def __init__(self) -> None:
        self._chain: list[tuple[str, str]] = []
        if settings.GROQ_API_KEY:
            self._chain.append(("groq", settings.GROQ_MODEL))
        if settings.NVIDIA_API_KEY:
            self._chain.append(("nvidia", settings.NVIDIA_MODEL))
        if settings.CEREBRAS_API_KEY:
            self._chain.append(("cerebras", settings.CEREBRAS_MODEL))
        self._chain.append(("mock", "mock"))
        print(f"[LLMClient] Provider chain: {' → '.join(p for p, _ in self._chain)}")

    async def ainvoke(self, prompt: str, system: str = "", max_tokens: int = 1024) -> LLMResponse:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        for provider, model in self._chain:
            try:
                if provider == "groq":
                    content = await _call_groq(messages, model, max_tokens)
                elif provider == "nvidia":
                    content = await _call_nvidia(messages, model, max_tokens)
                elif provider == "cerebras":
                    content = await _call_cerebras(messages, model, max_tokens)
                else:
                    content = _smart_mock(system, prompt)

                if provider != "mock":
                    print(f"[LLMClient] Used provider: {provider}")
                return LLMResponse(content=content)

            except RateLimitError as exc:
                print(f"[LLMClient] {provider} rate limited — trying next. {exc}")
            except Exception as exc:
                print(f"[LLMClient] {provider} error: {exc} — trying next.")

        print("[LLMClient] All providers failed — using mock fallback.")
        return LLMResponse(content=_smart_mock(system, prompt))
