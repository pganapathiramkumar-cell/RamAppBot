"""
Unit tests: WorkflowGenerationChain
Blueprint refs: AI-WF-001 → AI-WF-004
All tests use pre-recorded LLM response fixtures — no real API calls.
Schema-validation approach used throughout.
"""

import json
import pytest
import jsonschema
from unittest.mock import AsyncMock

from src.ai.chains.workflow import WorkflowGenerationChain, WORKFLOW_SCHEMA
from src.ai.llm_client import LLMResponse
from src.core.exceptions import ExtractionFailedError

_OBJECTIVES = "1. Review contract terms. 2. Sign agreement. 3. Notify legal."

_GOOD_WORKFLOW = json.dumps([
    {"step_number": 1, "action": "Review contract terms with legal counsel", "priority": "High"},
    {"step_number": 2, "action": "Sign and return agreement before deadline", "priority": "High"},
    {"step_number": 3, "action": "Notify legal team of signed agreement", "priority": "Medium"},
])

_SAMPLE_TEXT = "This contract requires review, signature, and legal notification."


class TestWorkflowGenerationChain:
    """AI-WF: Workflow generation chain tests."""

    @pytest.fixture
    def mock_llm(self):
        """Returns objectives on first call, workflow JSON on subsequent calls."""
        mock = AsyncMock()
        mock.ainvoke.side_effect = [
            LLMResponse(content=_OBJECTIVES),
            LLMResponse(content=_GOOD_WORKFLOW),
        ]
        return mock

    @pytest.mark.asyncio
    async def test_ai_wf_001_output_validates_workflow_schema(self, mock_llm):
        """Output must conform to WORKFLOW_SCHEMA."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        jsonschema.validate(instance=result, schema=WORKFLOW_SCHEMA)

    @pytest.mark.asyncio
    async def test_ai_wf_001_result_is_non_empty_list(self, mock_llm):
        """Result must be a list with at least one step."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        assert isinstance(result, list)
        assert len(result) >= 1

    @pytest.mark.asyncio
    async def test_ai_wf_001_each_step_has_required_fields(self, mock_llm):
        """Each step must contain step_number, action, and priority."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        for step in result:
            assert "step_number" in step
            assert "action" in step
            assert "priority" in step

    @pytest.mark.asyncio
    async def test_ai_wf_002_step_numbers_are_sequential_from_one(self, mock_llm):
        """Step numbers must be 1, 2, 3, ... with no gaps or duplicates."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        nums = [s["step_number"] for s in result]
        assert nums == list(range(1, len(nums) + 1))

    @pytest.mark.asyncio
    async def test_ai_wf_003_priority_is_valid_enum(self, mock_llm):
        """Each step's priority must be one of High / Medium / Low."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        valid = {"High", "Medium", "Low"}
        for step in result:
            assert step["priority"] in valid, f"Invalid priority: {step['priority']}"

    @pytest.mark.asyncio
    async def test_ai_wf_004_two_llm_calls_made(self, mock_llm):
        """Chain must call the LLM exactly twice (objectives + workflow)."""
        chain = WorkflowGenerationChain(llm=mock_llm)
        await chain.run(text=_SAMPLE_TEXT)
        assert mock_llm.ainvoke.call_count == 2

    @pytest.mark.asyncio
    async def test_ai_wf_005_bad_json_raises_extraction_failed(self):
        """After max_retries of malformed JSON, raises ExtractionFailedError."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = [
            LLMResponse(content=_OBJECTIVES),
            LLMResponse(content="not json"),
            LLMResponse(content="still not json"),
            LLMResponse(content="never json"),
        ]
        chain = WorkflowGenerationChain(llm=mock_llm, max_retries=3)
        with pytest.raises(ExtractionFailedError):
            await chain.run(text=_SAMPLE_TEXT)

    @pytest.mark.asyncio
    async def test_ai_wf_006_markdown_fence_stripped_from_workflow(self):
        """Workflow JSON inside a markdown code fence is parsed correctly."""
        mock_llm = AsyncMock()
        fenced = f"```json\n{_GOOD_WORKFLOW}\n```"
        mock_llm.ainvoke.side_effect = [
            LLMResponse(content=_OBJECTIVES),
            LLMResponse(content=fenced),
        ]
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        assert isinstance(result, list)
        assert len(result) >= 1

    @pytest.mark.asyncio
    async def test_ai_wf_007_out_of_order_step_numbers_are_normalised(self):
        """Even if LLM returns steps with wrong numbering, they are renumbered 1,2,3."""
        scrambled = json.dumps([
            {"step_number": 5, "action": "Do something first", "priority": "High"},
            {"step_number": 2, "action": "Do something second", "priority": "Low"},
        ])
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = [
            LLMResponse(content=_OBJECTIVES),
            LLMResponse(content=scrambled),
        ]
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        nums = [s["step_number"] for s in result]
        assert nums == list(range(1, len(nums) + 1))

    @pytest.mark.asyncio
    async def test_ai_wf_008_fixture_response_validates(self, llm_workflow_response):
        """Pre-recorded workflow fixture parses and validates correctly."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = [
            LLMResponse(content=_OBJECTIVES),
            LLMResponse(content=llm_workflow_response),
        ]
        chain = WorkflowGenerationChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        jsonschema.validate(instance=result, schema=WORKFLOW_SCHEMA)
