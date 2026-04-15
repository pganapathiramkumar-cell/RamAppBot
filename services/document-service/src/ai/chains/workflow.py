"""
Workflow chain — generates a Mermaid flowchart directly from document content.

Instead of inventing generic steps, the LLM reads the actual document and draws
the process, sequence, or key structure that is already described there.
"""

from __future__ import annotations

from src.core.exceptions import ExtractionFailedError

_FALLBACK_CHART = (
    'graph TD\n'
    '  A(["📄 Document Received"]) --> B(["📊 Analysis Complete"])\n'
    '  style A fill:#e0e7ff,stroke:#6366f1,color:#3730a3\n'
    '  style B fill:#d1fae5,stroke:#10b981,color:#065f46'
)

_MERMAID_SYSTEM = """You are a document analyst and diagram expert.

Read the document carefully and generate a Mermaid TD flowchart that shows the ACTUAL process, flow, or key sequence described in the document itself — not invented steps.

Rules:
- Extract the real structure FROM the document (roles, phases, dates, decisions, milestones)
- Each node label must be SHORT — 3 to 6 words maximum
- 5 to 8 nodes total
- Use graph TD (top-down)
- Apply style lines to color nodes by importance:
    Critical / high-priority  →  fill:#fee2e2,stroke:#ef4444,color:#991b1b
    Normal / standard step    →  fill:#fef9c3,stroke:#eab308,color:#854d0e
    Low / optional            →  fill:#dcfce7,stroke:#22c55e,color:#166534
    Start / End nodes         →  fill:#e0e7ff,stroke:#6366f1,color:#3730a3
- Return ONLY valid Mermaid syntax starting with "graph TD"
- No markdown fences, no explanation text whatsoever

Example (for a recruitment document):
graph TD
  A(["📋 Job Requisition"]) --> B["Screen Applications"]
  B --> C["Technical Interview"]
  C --> D{"Background Check"}
  D -->|Pass| E["Issue Offer Letter"]
  D -->|Fail| B
  E --> F(["✅ Onboarding"])
  style A fill:#e0e7ff,stroke:#6366f1,color:#3730a3
  style C fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style E fill:#fee2e2,stroke:#ef4444,color:#991b1b
  style F fill:#e0e7ff,stroke:#6366f1,color:#3730a3"""


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("mermaid"):
            raw = raw[len("mermaid"):]
        raw = raw.strip()
    return raw


class WorkflowGenerationChain:
    def __init__(self, llm=None, max_retries: int = 3):
        if llm is None:
            from src.ai.llm_client import LLMClient
            llm = LLMClient()
        self._llm = llm
        self.max_retries = max_retries

    async def run(self, text: str) -> str:
        """
        Generate a Mermaid flowchart from document text.
        Returns a Mermaid syntax string (graph TD ...).
        """
        for attempt in range(1, self.max_retries + 1):
            resp = await self._llm.ainvoke(text, system=_MERMAID_SYSTEM)
            raw = _strip_fences(resp.content)

            if raw.startswith("graph "):
                return raw

            if attempt == self.max_retries:
                return _FALLBACK_CHART

        return _FALLBACK_CHART
