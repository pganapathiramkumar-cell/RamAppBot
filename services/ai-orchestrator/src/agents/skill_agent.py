"""
Skill Agent — discovers, evaluates, and recommends enterprise AI skills.
Uses local Llama via Ollama with function calling.
"""

import json
import ollama


SKILL_SYSTEM_PROMPT = """You are Rambot's Enterprise AI Skill Advisor.
Your role is to help organizations build, evaluate, and optimize their AI skill catalog.

You assist with:
- Skill gap analysis across teams and projects
- Skill quality evaluation and scoring
- Learning path recommendations
- Skill-to-goal alignment mapping
- Industry benchmark comparisons

Be specific, measurable, and aligned with enterprise AI frameworks like TOGAF, AI CoE standards."""


_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_skill_catalog",
            "description": "Retrieve the current skill catalog for an organization",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": [
                            "nlp", "computer_vision", "data_analysis", "reasoning",
                            "code_generation", "multimodal", "agent", "custom",
                        ],
                    },
                },
                "required": ["organization_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "identify_skill_gaps",
            "description": "Identify skill gaps relative to steer goals",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "string"},
                    "goal_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["organization_id", "goal_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_learning_resources",
            "description": "Get learning resources for a specific skill",
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_name": {"type": "string"},
                    "proficiency_level": {
                        "type": "string",
                        "enum": ["beginner", "intermediate", "advanced", "expert"],
                    },
                },
                "required": ["skill_name"],
            },
        },
    },
]


class SkillAgent:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self._client = ollama.AsyncClient(host=base_url)
        self._model = model

    async def analyze_skill_gaps(
        self,
        organization_id: str,
        steer_goals: list[dict],
        current_skills: list[dict],
    ) -> str:
        messages: list[dict] = [
            {"role": "system", "content": SKILL_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Organization: {organization_id}\n"
                    f"Strategic Goals: {json.dumps(steer_goals, indent=2)}\n"
                    f"Current Skills: {json.dumps(current_skills, indent=2)}\n\n"
                    f"Perform a comprehensive skill gap analysis and provide a prioritized action plan."
                ),
            },
        ]

        for _ in range(10):  # safety cap
            response = await self._client.chat(
                model=self._model,
                messages=messages,
                tools=_TOOLS,
            )

            msg = response.message

            if not msg.tool_calls:
                return msg.content or "Skill gap analysis complete."

            messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": msg.tool_calls})

            for tool_call in msg.tool_calls:
                result = await self._execute_tool(
                    tool_call.function.name,
                    tool_call.function.arguments or {},
                )
                messages.append({"role": "tool", "content": json.dumps(result)})

        return "Skill gap analysis complete."

    async def _execute_tool(self, tool_name: str, tool_input: dict):
        if tool_name == "get_skill_catalog":
            return {"skills": ["NLP Pipeline", "Vision Classifier", "RAG System"], "count": 3}
        if tool_name == "identify_skill_gaps":
            return {
                "gaps": ["Explainable AI", "MLOps Automation", "Multimodal Reasoning"],
                "priority": "high",
            }
        if tool_name == "get_learning_resources":
            return {
                "resources": [{
                    "type": "course",
                    "title": "Advanced AI Patterns",
                    "url": "internal://courses/ai-patterns",
                }]
            }
        return {}
