"""
LLM client with automatic provider fallback chain.

Priority order:  Groq → NVIDIA NIM → Cerebras → Mock
Each provider is tried in order. If one hits a rate limit or is not
configured, the next one is used automatically.

Provider env vars:
  LLM_PROVIDER   — (optional) force a specific provider; leave blank for auto
  GROQ_API_KEY   — Groq cloud (100K tokens/day, resets daily)
  NVIDIA_API_KEY — NVIDIA NIM (1K free API calls, one-time)
  CEREBRAS_API_KEY — Cerebras cloud (1M tokens/month, resets monthly)
"""

import asyncio
import json
import re

from src.core.config import settings

_MAX_RETRIES = 2
_RETRY_DELAY = 1.0

# HTTP status codes that mean "rate limited / quota exceeded" — trigger fallback
_RATE_LIMIT_CODES = {429, 529}


class LLMResponse:
    def __init__(self, content: str):
        self.content = content


class RateLimitError(Exception):
    """Raised when a provider is rate-limited so the fallback chain can continue."""


# ── Smart mock (CI / all-providers-exhausted fallback) ────────────────────────

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
    from collections import Counter
    freq = Counter(name_pat.findall(text))
    names = [n for n, _ in freq.most_common(8) if len(n) > 3][:6]
    clause_kw = re.compile(r'\b(clause|provision|agreement|terms?|conditions?|liability|obligation|warranty|indemnif|termination)\b', re.I)
    task_kw   = re.compile(r'\b(shall|must|will|should|required to|responsible for|needs? to|ensure)\b', re.I)
    risk_kw   = re.compile(r'\b(risk|liability|penalty|breach|violat|fail|damage|loss|dispute|delay)\b', re.I)
    clauses, tasks, risks = [], [], []
    for s in _sentences(text, 30):
        if clause_kw.search(s) and s[:100] not in clauses: clauses.append(s[:100])
        if task_kw.search(s)   and s[:100] not in tasks:   tasks.append(s[:100])
        if risk_kw.search(s)   and s[:100] not in risks:   risks.append(s[:100])
        if len(clauses) >= 4 and len(tasks) >= 5 and len(risks) >= 4: break
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
                "tools": [],
                "systems": [],
                "metrics": [],
                "people": [],
                "organizations": [],
            },
            "relationships": [],
            "key_concepts": ["document", "summary"],
        })
    if "names" in s and "dates" in s:
        return _mock_entities(prompt)
    return _mock_summary(prompt)


# ── Individual provider callers ────────────────────────────────────────────────

async def _call_groq(messages: list[dict], model: str, max_tokens: int) -> str:
    from groq import AsyncGroq, RateLimitError as GroqRateLimit
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""
    except GroqRateLimit as e:
        raise RateLimitError(f"Groq rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            raise RateLimitError(f"Groq rate limited: {e}") from e
        raise


async def _call_nvidia(messages: list[dict], model: str, max_tokens: int) -> str:
    from openai import AsyncOpenAI, RateLimitError as OAIRateLimit
    client = AsyncOpenAI(api_key=settings.NVIDIA_API_KEY, base_url=settings.NVIDIA_BASE_URL)
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""
    except OAIRateLimit as e:
        raise RateLimitError(f"NVIDIA rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "credits" in str(e).lower() or "quota" in str(e).lower():
            raise RateLimitError(f"NVIDIA quota exceeded: {e}") from e
        raise


async def _call_cerebras(messages: list[dict], model: str, max_tokens: int) -> str:
    from openai import AsyncOpenAI, RateLimitError as OAIRateLimit
    client = AsyncOpenAI(
        api_key=settings.CEREBRAS_API_KEY,
        base_url="https://api.cerebras.ai/v1",
    )
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""
    except OAIRateLimit as e:
        raise RateLimitError(f"Cerebras rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            raise RateLimitError(f"Cerebras rate limited: {e}") from e
        raise


# ── LLM Client ────────────────────────────────────────────────────────────────

class LLMClient:
    """
    Async LLM client with automatic fallback chain.

    Order: Groq → NVIDIA NIM → Cerebras → Mock
    A provider is skipped if its API key is not configured.
    If a provider returns a rate-limit error, the next one is tried.
    """

    def __init__(self):
        # Build the active provider chain based on available keys
        self._chain: list[tuple[str, str]] = []

        if settings.GROQ_API_KEY:
            self._chain.append(("groq", settings.GROQ_MODEL))
        if settings.NVIDIA_API_KEY:
            self._chain.append(("nvidia", settings.NVIDIA_MODEL))
        if settings.CEREBRAS_API_KEY:
            self._chain.append(("cerebras", settings.CEREBRAS_MODEL))

        # Always append mock as final fallback
        self._chain.append(("mock", "mock"))

        active = [p for p, _ in self._chain]
        print(f"[LLMClient] Provider chain: {' → '.join(active)}")

    async def ainvoke(self, prompt: str, system: str = "", max_tokens: int = 1024) -> LLMResponse:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        last_error: Exception | None = None

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

            except RateLimitError as e:
                print(f"[LLMClient] {provider} rate limited — trying next provider. {e}")
                last_error = e
                continue
            except Exception as e:
                print(f"[LLMClient] {provider} error: {e} — trying next provider.")
                last_error = e
                continue

        # All providers failed — return mock as emergency fallback
        print("[LLMClient] All providers failed — using mock fallback.")
        return LLMResponse(content=_smart_mock(system, prompt))
