"""
AI Client for Skill Service.
Uses the multi-provider LLM fallback chain (Groq → NVIDIA → Cerebras → Mock).
"""

import json

from src.infrastructure.ai.llm_client import LLMClient


_TAG_SYSTEM = (
    "You are an Enterprise AI Skill Catalog expert. "
    "Return ONLY a JSON array of lowercase tag strings — no markdown, no extra text."
)

_QUALITY_SYSTEM = (
    "You are an Enterprise AI Quality Assessor. "
    "Return ONLY valid JSON — no markdown, no extra text."
)

_PAIRING_SYSTEM = (
    "You are an Enterprise AI Architect. "
    "Return ONLY a JSON array of skill name strings — no markdown, no extra text."
)


def _strip_fence(raw: str) -> str:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


class SkillAIClient:
    def __init__(self, llm: LLMClient):
        self._llm = llm

    async def auto_tag_skill(self, name: str, description: str) -> list[str]:
        """Auto-generate 5–8 relevant tags for a skill."""
        prompt = (
            f"Generate 5-8 relevant tags for this enterprise AI skill.\n"
            f"Name: {name}\nDescription: {description}\n\n"
            f"Return ONLY a JSON array of lowercase strings."
        )
        raw = await self._llm.ainvoke(prompt, system=_TAG_SYSTEM)
        try:
            result = json.loads(_strip_fence(raw))
            if isinstance(result, list):
                return [str(t).lower() for t in result]
            return ["ai", "automation"]
        except (json.JSONDecodeError, ValueError):
            return ["ai", "automation"]

    async def evaluate_skill_quality(
        self,
        name: str,
        description: str,
        accuracy_score: float,
        latency_ms: float,
        usage_count: int,
    ) -> dict:
        """Evaluate skill quality. Returns {quality_score, strengths, improvements}."""
        prompt = (
            f"Evaluate this enterprise AI skill.\n"
            f"Name: {name}\nDescription: {description}\n"
            f"Accuracy: {accuracy_score:.2%}\nLatency: {latency_ms}ms\nUsage: {usage_count}\n\n"
            f"Return ONLY JSON: {{\"quality_score\": float, \"strengths\": [str], \"improvements\": [str]}}"
        )
        raw = await self._llm.ainvoke(prompt, system=_QUALITY_SYSTEM)
        try:
            result = json.loads(_strip_fence(raw))
            if isinstance(result, dict) and "quality_score" in result:
                return result
            return {"quality_score": 0.5, "strengths": [], "improvements": []}
        except (json.JSONDecodeError, ValueError):
            return {"quality_score": 0.5, "strengths": [], "improvements": []}

    async def suggest_skill_pairing(
        self,
        skill_name: str,
        all_skill_names: list[str],
    ) -> list[str]:
        """Suggest top 3 complementary skills from the catalog."""
        prompt = (
            f"From this list of enterprise AI skills, suggest the top 3 that best complement '{skill_name}'.\n"
            f"Available: {', '.join(all_skill_names)}\n\n"
            f"Return ONLY a JSON array of skill names: [\"skill1\", \"skill2\", \"skill3\"]"
        )
        raw = await self._llm.ainvoke(prompt, system=_PAIRING_SYSTEM)
        try:
            result = json.loads(_strip_fence(raw))
            if isinstance(result, list):
                return [str(r) for r in result]
            return []
        except (json.JSONDecodeError, ValueError):
            return []
