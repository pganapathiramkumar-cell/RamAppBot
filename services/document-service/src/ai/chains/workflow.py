"""
Workflow chain — generates structured workflow steps from document content.

Returns a list of step dicts with: step_number, action, priority,
description, owner, deadline.
"""

from __future__ import annotations

import json
import re

from src.core.exceptions import ExtractionFailedError

_MAX_WORKFLOW_CHARS = 12_000

WORKFLOW_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "required": ["step_number", "action", "priority"],
        "properties": {
            "step_number": {"type": "integer"},
            "action":      {"type": "string"},
            "priority":    {"type": "string", "enum": ["High", "Medium", "Low"]},
            "description": {"type": ["string", "null"]},
            "owner":       {"type": ["string", "null"]},
            "deadline":    {"type": ["string", "null"]},
        },
        "additionalProperties": False,
    },
}

_FALLBACK_STEPS = [
    {
        "step_number": 1,
        "action":      "Review Document",
        "priority":    "Medium",
        "description": "Read and understand the full document content.",
        "owner":       None,
        "deadline":    None,
    },
    {
        "step_number": 2,
        "action":      "Identify Key Actions",
        "priority":    "High",
        "description": "Extract tasks, dates, and responsibilities.",
        "owner":       None,
        "deadline":    None,
    },
    {
        "step_number": 3,
        "action":      "Complete Required Steps",
        "priority":    "Medium",
        "description": "Execute the identified actions in order.",
        "owner":       None,
        "deadline":    None,
    },
]

_SYSTEM = """You are a document analyst. Read the document carefully and extract a structured workflow of 3 to 6 concrete action steps that a person would need to follow based on the document's content.

Return ONLY a valid JSON array. No explanation, no markdown fences, no extra text.

Each step must have exactly these fields:
- step_number: integer starting at 1
- action: short imperative verb phrase (max 8 words), e.g. "Submit signed agreement to legal"
- priority: one of "High", "Medium", or "Low"
- description: one sentence explaining what this step involves (max 20 words)
- owner: the role or person responsible, or null if not mentioned
- deadline: the deadline or timeframe as a string, or null if not mentioned

Use real names, roles, dates and systems from the document. Do not invent generic steps.

Example output:
[
  {"step_number": 1, "action": "Review contract terms", "priority": "High", "description": "Legal team checks all clauses before signing.", "owner": "Legal Team", "deadline": "Jan 15"},
  {"step_number": 2, "action": "Obtain stakeholder approval", "priority": "High", "description": "Get sign-off from all department heads.", "owner": "Project Manager", "deadline": null},
  {"step_number": 3, "action": "File with compliance team", "priority": "Medium", "description": "Submit approved document to regulatory body.", "owner": "Compliance", "deadline": "Jan 30"}
]"""


def _parse_steps(raw: str) -> list[dict]:
    """Extract JSON array from LLM response, clean it up."""
    raw = raw.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    # Find the JSON array
    start = raw.find("[")
    end   = raw.rfind("]")
    if start == -1 or end == -1:
        return []

    try:
        steps = json.loads(raw[start : end + 1])
        if not isinstance(steps, list):
            return []

        validated = []
        for i, s in enumerate(steps):
            if not isinstance(s, dict):
                continue
            validated.append({
                "step_number": int(s.get("step_number", i + 1)),
                "action":      str(s.get("action", "Step")).strip(),
                "priority":    s.get("priority", "Medium") if s.get("priority") in ("High", "Medium", "Low") else "Medium",
                "description": str(s["description"]).strip() if s.get("description") else None,
                "owner":       str(s["owner"]).strip() if s.get("owner") else None,
                "deadline":    str(s["deadline"]).strip() if s.get("deadline") else None,
            })
        # Sort by original step_number then renumber 1,2,3... regardless of LLM output
        validated.sort(key=lambda x: x["step_number"])
        for i, step in enumerate(validated):
            step["step_number"] = i + 1
        return validated
    except (json.JSONDecodeError, ValueError):
        return []


class WorkflowGenerationChain:
    def __init__(self, llm=None, max_retries: int = 3, semaphore=None):
        if llm is None:
            from src.ai.llm_client import LLMClient
            llm = LLMClient()
        self._llm = llm
        self.max_retries = max_retries
        self._sem = semaphore

    async def run(self, text: str, chunks: list[str] | None = None) -> list[dict]:
        """
        Generate structured workflow steps from document text.
        For large documents, uses the first chunk + last chunk so the LLM
        sees both the document opening (context) and closing (conclusions/actions)
        without exceeding the context window.
        """
        if len(text) > _MAX_WORKFLOW_CHARS:
            if chunks and len(chunks) >= 2:
                # First chunk sets context; last chunk has conclusions/actions
                half = _MAX_WORKFLOW_CHARS // 2
                condensed = chunks[0][:half] + "\n\n[...]\n\n" + chunks[-1][:half]
            else:
                # No pre-computed chunks — take head + tail of raw text
                half = _MAX_WORKFLOW_CHARS // 2
                condensed = text[:half] + "\n\n[...]\n\n" + text[-half:]
            input_text = condensed
        else:
            input_text = text

        for attempt in range(1, self.max_retries + 1):
            if self._sem:
                async with self._sem:
                    resp = await self._llm.ainvoke(input_text, system=_SYSTEM, max_tokens=800)
            else:
                resp = await self._llm.ainvoke(input_text, system=_SYSTEM, max_tokens=800)
            steps = _parse_steps(resp.content)
            if steps:
                return steps
            if attempt == self.max_retries:
                return _FALLBACK_STEPS

        return _FALLBACK_STEPS
