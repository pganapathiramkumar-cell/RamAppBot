"""
Multi-provider LLM client for Steer Service.
Fallback chain: Groq → NVIDIA NIM → Cerebras → Mock
"""

import json
import re

from src.config.settings import settings


class _RateLimitError(Exception):
    pass


def _strip_fence(raw: str) -> str:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


async def _call_groq(messages: list[dict], model: str) -> str:
    from groq import AsyncGroq, RateLimitError as GroqRateLimit
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=1024,
        )
        return resp.choices[0].message.content or ""
    except GroqRateLimit as e:
        raise _RateLimitError(f"Groq rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            raise _RateLimitError(f"Groq rate limited: {e}") from e
        raise


async def _call_nvidia(messages: list[dict], model: str) -> str:
    from openai import AsyncOpenAI, RateLimitError as OAIRateLimit
    client = AsyncOpenAI(api_key=settings.NVIDIA_API_KEY, base_url=settings.NVIDIA_BASE_URL)
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=1024,
        )
        return resp.choices[0].message.content or ""
    except OAIRateLimit as e:
        raise _RateLimitError(f"NVIDIA rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            raise _RateLimitError(f"NVIDIA quota exceeded: {e}") from e
        raise


async def _call_cerebras(messages: list[dict], model: str) -> str:
    from openai import AsyncOpenAI, RateLimitError as OAIRateLimit
    client = AsyncOpenAI(api_key=settings.CEREBRAS_API_KEY, base_url="https://api.cerebras.ai/v1")
    try:
        resp = await client.chat.completions.create(
            model=model, messages=messages, temperature=0.1, max_tokens=1024,
        )
        return resp.choices[0].message.content or ""
    except OAIRateLimit as e:
        raise _RateLimitError(f"Cerebras rate limited: {e}") from e
    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            raise _RateLimitError(f"Cerebras rate limited: {e}") from e
        raise


class LLMClient:
    """Async LLM client with automatic fallback: Groq → NVIDIA → Cerebras → Mock."""

    def __init__(self):
        self._chain: list[tuple[str, str]] = []
        if settings.GROQ_API_KEY:
            self._chain.append(("groq", settings.GROQ_MODEL))
        if settings.NVIDIA_API_KEY:
            self._chain.append(("nvidia", settings.NVIDIA_MODEL))
        if settings.CEREBRAS_API_KEY:
            self._chain.append(("cerebras", settings.CEREBRAS_MODEL))
        self._chain.append(("mock", "mock"))
        active = [p for p, _ in self._chain]
        print(f"[LLMClient/steer] Provider chain: {' → '.join(active)}")

    async def ainvoke(self, prompt: str, system: str = "") -> str:
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        for provider, model in self._chain:
            try:
                if provider == "groq":
                    return await _call_groq(messages, model)
                elif provider == "nvidia":
                    return await _call_nvidia(messages, model)
                elif provider == "cerebras":
                    return await _call_cerebras(messages, model)
                else:
                    return '{"score": 0.5}'  # safe mock fallback
            except _RateLimitError as e:
                print(f"[LLMClient/steer] {provider} rate limited — next. {e}")
                continue
            except Exception as e:
                print(f"[LLMClient/steer] {provider} error: {e} — next.")
                continue

        return '{"score": 0.5}'
