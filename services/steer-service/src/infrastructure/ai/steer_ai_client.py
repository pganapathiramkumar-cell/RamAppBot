"""
AI Client for Steer Service — local Llama via Ollama.

Computes strategic alignment scores and recommendations without
any cloud API calls. Ollama must be running locally.
"""

import json
import ollama


class SteerAIClient:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self._client = ollama.AsyncClient(host=base_url)
        self._model = model

    async def compute_alignment_score(
        self,
        goal_title: str,
        goal_description: str,
        success_criteria: list[str],
        organization_context: str,
    ) -> float:
        """
        Ask Llama to evaluate how well a steer goal aligns with
        the organisation's AI strategy. Returns a score 0.0–1.0.
        """
        criteria_text = "\n".join(f"- {c}" for c in success_criteria)
        prompt = f"""You are an Enterprise AI Strategy Advisor.

Evaluate the following AI steering goal and return ONLY a JSON object with a single key "score" (float 0.0-1.0).
1.0 = perfectly aligned, 0.0 = completely misaligned.

Organization Context:
{organization_context}

Goal Title: {goal_title}
Goal Description: {goal_description}
Success Criteria:
{criteria_text}

Respond with ONLY: {{"score": <float>}}"""

        response = await self._client.chat(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.message.content.strip()
        # Strip markdown fence if model adds one
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        result = json.loads(raw)
        return float(result["score"])

    async def generate_recommendations(
        self,
        goal_title: str,
        goal_description: str,
        current_status: str,
    ) -> list[str]:
        """Generate actionable recommendations to advance a steer goal."""
        response = await self._client.chat(
            model=self._model,
            messages=[{
                "role": "user",
                "content": (
                    f"As an Enterprise AI Architect, provide 3-5 actionable recommendations "
                    f"to advance this AI steering goal.\n\n"
                    f"Goal: {goal_title}\nDescription: {goal_description}\nStatus: {current_status}\n\n"
                    f"Return a JSON array of strings: [\"recommendation 1\", ...]"
                )
            }],
        )
        raw = response.message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        return json.loads(raw)
