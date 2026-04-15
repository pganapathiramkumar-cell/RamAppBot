"""
AI Client for Skill Service — local Llama via Ollama.

Evaluates, tags, and enriches skills automatically
without any cloud API calls.
"""

import json
import ollama


def _strip_fence(raw: str) -> str:
    """Remove markdown code fences if the model adds them."""
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


class SkillAIClient:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self._client = ollama.AsyncClient(host=base_url)
        self._model = model

    async def auto_tag_skill(self, name: str, description: str) -> list[str]:
        """Auto-generate relevant tags for a skill using AI."""
        response = await self._client.chat(
            model=self._model,
            messages=[{
                "role": "user",
                "content": (
                    f"Generate 5-8 relevant tags for this AI skill.\n"
                    f"Name: {name}\nDescription: {description}\n\n"
                    f"Return only a JSON array of lowercase strings."
                )
            }],
        )
        return json.loads(_strip_fence(response.message.content.strip()))

    async def evaluate_skill_quality(
        self,
        name: str,
        description: str,
        accuracy_score: float,
        latency_ms: float,
        usage_count: int,
    ) -> dict:
        """
        Evaluate skill quality and return a structured assessment.
        Returns: {quality_score: float, strengths: list, improvements: list}
        """
        response = await self._client.chat(
            model=self._model,
            messages=[{
                "role": "user",
                "content": (
                    f"Evaluate this enterprise AI skill.\n"
                    f"Name: {name}\nDescription: {description}\n"
                    f"Accuracy: {accuracy_score:.2%}\nLatency: {latency_ms}ms\nUsage: {usage_count}\n\n"
                    f"Return JSON: {{\"quality_score\": float, \"strengths\": [str], \"improvements\": [str]}}"
                )
            }],
        )
        return json.loads(_strip_fence(response.message.content.strip()))

    async def suggest_skill_pairing(
        self,
        skill_name: str,
        all_skill_names: list[str],
    ) -> list[str]:
        """Suggest complementary skills from the catalog."""
        response = await self._client.chat(
            model=self._model,
            messages=[{
                "role": "user",
                "content": (
                    f"From this list of enterprise AI skills, suggest top 3 that best complement '{skill_name}'.\n"
                    f"Available skills: {', '.join(all_skill_names)}\n\n"
                    f"Return JSON array of skill names: [\"skill1\", \"skill2\", \"skill3\"]"
                )
            }],
        )
        return json.loads(_strip_fence(response.message.content.strip()))
