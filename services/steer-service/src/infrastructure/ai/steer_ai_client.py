"""
AI Client for Steer Service.
Uses the multi-provider LLM fallback chain (Groq → NVIDIA → Cerebras → Mock).
"""

import json

from src.infrastructure.ai.llm_client import LLMClient


_ALIGNMENT_SYSTEM = (
    "You are an Enterprise AI Strategy Advisor. "
    "Evaluate AI steering goals and return ONLY valid JSON — no markdown, no extra text."
)

_RECOMMENDATIONS_SYSTEM = (
    "You are an Enterprise AI Architect. "
    "Return ONLY a JSON array of strings — no markdown, no extra text."
)


def _strip_fence(raw: str) -> str:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


class SteerAIClient:
    def __init__(self, llm: LLMClient):
        self._llm = llm

    async def compute_alignment_score(
        self,
        goal_title: str,
        goal_description: str,
        success_criteria: list[str],
        organization_context: str,
    ) -> float:
        """Score how well a steer goal aligns with the org's AI strategy (0.0–1.0)."""
        criteria_text = "\n".join(f"- {c}" for c in success_criteria)
        prompt = (
            f"Organization Context:\n{organization_context}\n\n"
            f"Goal Title: {goal_title}\n"
            f"Goal Description: {goal_description}\n"
            f"Success Criteria:\n{criteria_text}\n\n"
            f"Return ONLY: {{\"score\": <float 0.0-1.0>}}"
        )
        raw = await self._llm.ainvoke(prompt, system=_ALIGNMENT_SYSTEM)
        try:
            result = json.loads(_strip_fence(raw))
            score = float(result.get("score", 0.5))
            return max(0.0, min(1.0, score))
        except (json.JSONDecodeError, KeyError, ValueError):
            return 0.5

    async def generate_recommendations(
        self,
        goal_title: str,
        goal_description: str,
        current_status: str,
    ) -> list[str]:
        """Generate 3–5 actionable recommendations to advance a steer goal."""
        prompt = (
            f"Provide 3-5 actionable recommendations to advance this AI steering goal.\n\n"
            f"Goal: {goal_title}\n"
            f"Description: {goal_description}\n"
            f"Status: {current_status}\n\n"
            f"Return ONLY a JSON array: [\"recommendation 1\", ...]"
        )
        raw = await self._llm.ainvoke(prompt, system=_RECOMMENDATIONS_SYSTEM)
        try:
            result = json.loads(_strip_fence(raw))
            if isinstance(result, list):
                return [str(r) for r in result]
            return ["Review goal alignment with strategic objectives."]
        except (json.JSONDecodeError, ValueError):
            return ["Review goal alignment with strategic objectives."]
