"""
Steer Agent — AI agent that reasons about enterprise AI strategy goals.
Uses local Llama via Ollama with function calling for multi-step analysis.

Requires: ollama pull llama3.2  (or llama3.1 for larger context)
"""

import json
import ollama
from typing import Any


STEER_SYSTEM_PROMPT = """You are Rambot's Enterprise AI Strategy Agent.
Your role is to help organizations steer their AI initiatives effectively.

You have access to tools to:
- Fetch organization context and current AI goals
- Analyze goal alignment with industry best practices
- Generate strategic recommendations
- Identify risks and dependencies

Always be precise, evidence-based, and actionable in your responses.
Format your responses for enterprise executives and AI architects."""


# Ollama uses OpenAI-compatible tool schema (type/function/parameters)
_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_organization_ai_maturity",
            "description": "Get the AI maturity level and current capabilities of the organization",
            "parameters": {
                "type": "object",
                "properties": {
                    "organization_id": {"type": "string", "description": "Organization UUID"}
                },
                "required": ["organization_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_goal_dependencies",
            "description": "Identify dependencies between steer goals",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of goal UUIDs to analyze",
                    }
                },
                "required": ["goal_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "benchmark_against_industry",
            "description": "Benchmark organizational AI goals against industry standards",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_type": {
                        "type": "string",
                        "enum": ["strategic", "operational", "compliance", "innovation"],
                    },
                    "industry": {"type": "string", "description": "Industry sector"},
                },
                "required": ["goal_type", "industry"],
            },
        },
    },
]


class SteerAgent:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self._client = ollama.AsyncClient(host=base_url)
        self._model = model

    async def analyze_strategic_goals(
        self,
        organization_id: str,
        goals: list[dict],
        user_question: str,
    ) -> str:
        """
        Agentic loop: Llama calls tools until it produces a final text answer.
        """
        messages: list[dict] = [
            {"role": "system", "content": STEER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Organization ID: {organization_id}\n"
                    f"Current Goals: {json.dumps(goals, indent=2)}\n\n"
                    f"Question: {user_question}"
                ),
            },
        ]

        # Agentic loop — exit when no more tool calls
        for _ in range(10):  # safety cap: max 10 iterations
            response = await self._client.chat(
                model=self._model,
                messages=messages,
                tools=_TOOLS,
            )

            msg = response.message

            # No tool calls → final answer
            if not msg.tool_calls:
                return msg.content or "Analysis complete."

            # Add assistant message (with tool_calls) to history
            messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": msg.tool_calls})

            # Execute each tool and add results
            for tool_call in msg.tool_calls:
                name = tool_call.function.name
                args = tool_call.function.arguments or {}
                result = await self._execute_tool(name, args)
                messages.append({"role": "tool", "content": json.dumps(result)})

        return "Analysis complete."

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> Any:
        if tool_name == "get_organization_ai_maturity":
            return {
                "maturity_level": "advanced",
                "score": 0.78,
                "capabilities": ["NLP", "Vision", "MLOps"],
            }
        if tool_name == "analyze_goal_dependencies":
            return {
                "dependencies": [],
                "critical_path": tool_input.get("goal_ids", [])[:2],
            }
        if tool_name == "benchmark_against_industry":
            return {
                "percentile": 72,
                "gap_areas": ["Explainability", "Governance"],
                "leaders": ["Company A", "Company B"],
            }
        return {}
