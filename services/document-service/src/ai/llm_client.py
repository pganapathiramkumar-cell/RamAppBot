"""
LLM client abstraction.

Provider selection via LLM_PROVIDER env var:
  "groq"   — Groq cloud API (Llama 3.1/3.3 models, free tier, production-ready)
  "ollama" — local Llama via Ollama daemon (local dev only)
  "mock"   — pure-Python regex analysis (CI/testing only, no AI)
"""

import asyncio
import json
import re

from src.core.config import settings

_MAX_RETRIES = 3
_RETRY_DELAY = 1.0


class LLMResponse:
    def __init__(self, content: str):
        self.content = content


# ── Smart mock (CI/testing only) ───────────────────────────────────────────────

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
    task_kw = re.compile(r'\b(shall|must|will|should|required to|responsible for|needs? to|ensure)\b', re.I)
    risk_kw = re.compile(r'\b(risk|liability|penalty|breach|violat|fail|damage|loss|dispute|delay)\b', re.I)
    clauses, tasks, risks = [], [], []
    for s in _sentences(text, 30):
        if clause_kw.search(s) and s[:100] not in clauses: clauses.append(s[:100])
        if task_kw.search(s) and s[:100] not in tasks: tasks.append(s[:100])
        if risk_kw.search(s) and s[:100] not in risks: risks.append(s[:100])
        if len(clauses) >= 4 and len(tasks) >= 5 and len(risks) >= 4: break
    return json.dumps({
        "names":   names   or ["(none identified)"],
        "dates":   dates   or ["(none identified)"],
        "clauses": clauses[:4] or ["(none identified)"],
        "tasks":   tasks[:5]   or ["(none identified)"],
        "risks":   risks[:4]   or ["(none identified)"],
    })


def _mock_workflow(text: str) -> str:
    action_kw = re.compile(r'\b(submit|review|approve|sign|complete|verify|confirm|prepare|schedule|contact|send|upload|assess|evaluate|update|notify|implement|resolve)\b', re.I)
    priorities = ["High", "High", "Medium", "Medium", "Low"]
    steps, seen = [], set()
    for s in _sentences(text, 30):
        m = action_kw.search(s)
        if m:
            action = f"{m.group(1).capitalize()} — {s[:80].strip()}"
            if action not in seen:
                seen.add(action)
                steps.append(action)
        if len(steps) >= 5: break
    if not steps:
        steps = ["Review document", "Identify obligations", "Verify dates", "Confirm compliance", "Obtain approvals"]
    return json.dumps([{"step_number": i+1, "action": s[:120], "priority": priorities[i % len(priorities)]} for i, s in enumerate(steps)])


def _smart_mock(system: str, prompt: str) -> str:
    s = system.lower()
    if "step_number" in s or ("json array" in s and "action" in s):
        return _mock_workflow(prompt)
    if "objective" in s:
        return "\n".join(f"- {sent}" for sent in _sentences(prompt, 5)) or "- Review the document."
    if "names" in s and "dates" in s:
        return _mock_entities(prompt)
    return _mock_summary(prompt)


# ── LLM Client ────────────────────────────────────────────────────────────────

class LLMClient:
    """
    Async LLM wrapper.

    LLM_PROVIDER:
      "groq"   — Groq cloud (Llama 3 models, production-ready, free tier)
      "nvidia" — NVIDIA NIM (OpenAI-compatible, free credits at build.nvidia.com)
      "ollama" — local Ollama daemon (local dev, needs `ollama serve`)
      "mock"   — Python regex analysis (CI/testing only, not real AI)
    """

    def __init__(self, model: str | None = None):
        self.provider = settings.LLM_PROVIDER
        self._groq_client = None
        self._nvidia_client = None
        self._ollama_client = None

        if self.provider == "groq":
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY is not set.")
            from groq import AsyncGroq
            self._groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            self._model = model or settings.GROQ_MODEL

        elif self.provider == "nvidia":
            if not settings.NVIDIA_API_KEY:
                raise ValueError("NVIDIA_API_KEY is not set.")
            from openai import AsyncOpenAI
            self._nvidia_client = AsyncOpenAI(
                api_key=settings.NVIDIA_API_KEY,
                base_url=settings.NVIDIA_BASE_URL,
            )
            self._model = model or settings.NVIDIA_MODEL

        elif self.provider == "ollama":
            import ollama
            self._ollama_client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
            self._model = model or settings.OLLAMA_MODEL

        else:
            self._model = "mock"

    async def ainvoke(self, prompt: str, system: str = "") -> LLMResponse:
        last_error: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return await self._invoke_once(prompt, system)
            except (ConnectionError, TimeoutError, OSError) as exc:
                last_error = exc
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_DELAY * attempt)
        raise last_error  # type: ignore[misc]

    async def _invoke_once(self, prompt: str, system: str) -> LLMResponse:
        # ── Mock ──────────────────────────────────────────────────────────────
        if self.provider == "mock":
            return LLMResponse(content=_smart_mock(system, prompt))

        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        # ── Groq ──────────────────────────────────────────────────────────────
        if self.provider == "groq" and self._groq_client:
            response = await self._groq_client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=0.1,
                max_tokens=2048,
            )
            return LLMResponse(content=response.choices[0].message.content or "")

        # ── NVIDIA NIM ────────────────────────────────────────────────────────
        if self.provider == "nvidia" and self._nvidia_client:
            response = await self._nvidia_client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=0.1,
                max_tokens=2048,
            )
            return LLMResponse(content=response.choices[0].message.content or "")

        # ── Ollama ────────────────────────────────────────────────────────────
        if self.provider == "ollama" and self._ollama_client:
            response = await self._ollama_client.chat(model=self._model, messages=messages)
            return LLMResponse(content=response.message.content or "")

        raise ValueError(f"Unknown LLM provider: {self.provider}")
