"""
Unit tests: EntityExtractionChain
Blueprint refs: AI-EXT-001 → AI-EXT-004
All tests use pre-recorded LLM response fixtures — no real API calls.
Schema-validation approach: assert JSON structure, not exact values.
"""

import json
import pytest
import jsonschema
from unittest.mock import AsyncMock

from src.ai.chains.extract import EntityExtractionChain, ENTITY_SCHEMA
from src.ai.llm_client import LLMResponse
from src.core.exceptions import ExtractionFailedError

_GOOD_RESPONSE = json.dumps({
    "names": ["Acme Corp", "John Smith"],
    "dates": ["2026-04-01"],
    "clauses": ["NDA clause in Section 4"],
    "tasks": ["Sign by April 30"],
    "risks": ["Termination without cause"],
})

_EMPTY_RESPONSE = json.dumps({
    "names": [], "dates": [], "clauses": [], "tasks": [], "risks": [],
})

_SAMPLE_TEXT = "This contract is between Acme Corp and John Smith, dated 2026-04-01."


class TestEntityExtractionChain:
    """AI-EXT: Entity extraction chain tests."""

    @pytest.fixture
    def mock_llm(self):
        mock = AsyncMock()
        mock.ainvoke.return_value = LLMResponse(content=_GOOD_RESPONSE)
        return mock

    @pytest.mark.asyncio
    async def test_ai_ext_001_output_validates_against_entity_schema(self, mock_llm):
        """Critical: output must always conform to the entity JSON schema."""
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        jsonschema.validate(instance=result, schema=ENTITY_SCHEMA)

    @pytest.mark.asyncio
    async def test_ai_ext_001_all_required_keys_present(self, mock_llm):
        """All 5 entity keys (names, dates, clauses, tasks, risks) must be present."""
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        for key in ("names", "dates", "clauses", "tasks", "risks"):
            assert key in result, f"Missing key: {key}"

    @pytest.mark.asyncio
    async def test_ai_ext_001_all_values_are_lists(self, mock_llm):
        """Every entity field must be a list of strings."""
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        for key in ("names", "dates", "clauses", "tasks", "risks"):
            assert isinstance(result[key], list), f"{key} is not a list"

    @pytest.mark.asyncio
    async def test_ai_ext_002_retries_on_malformed_json(self):
        """If LLM returns malformed JSON, chain retries up to max_retries times."""
        call_count = 0

        async def flaky_invoke(prompt, system="", **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return LLMResponse(content="{broken json")
            return LLMResponse(content=_GOOD_RESPONSE)

        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = flaky_invoke
        chain = EntityExtractionChain(llm=mock_llm, max_retries=3)
        result = await chain.run(text=_SAMPLE_TEXT)
        assert call_count == 3
        assert isinstance(result["names"], list)

    @pytest.mark.asyncio
    async def test_ai_ext_003_max_retries_exceeded_raises_extraction_failed(self):
        """After max_retries failed JSON parses, raises ExtractionFailedError."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content="not json at all")
        chain = EntityExtractionChain(llm=mock_llm, max_retries=3)
        with pytest.raises(ExtractionFailedError):
            await chain.run(text=_SAMPLE_TEXT)

    @pytest.mark.asyncio
    async def test_ai_ext_003_exactly_max_retries_attempts_made(self):
        """Exactly max_retries attempts are made before raising."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content="bad json")
        chain = EntityExtractionChain(llm=mock_llm, max_retries=3)
        with pytest.raises(ExtractionFailedError):
            await chain.run(text=_SAMPLE_TEXT)
        assert mock_llm.ainvoke.call_count == 3

    @pytest.mark.asyncio
    async def test_ai_ext_004_empty_arrays_are_valid_output(self):
        """All arrays can be empty — valid for sparse documents."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content=_EMPTY_RESPONSE)
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text="A very generic document.")
        jsonschema.validate(instance=result, schema=ENTITY_SCHEMA)
        assert result["names"] == []

    @pytest.mark.asyncio
    async def test_ai_ext_005_markdown_code_fence_stripped(self):
        """LLM responses wrapped in ```json ... ``` are parsed correctly."""
        fenced = f"```json\n{_GOOD_RESPONSE}\n```"
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content=fenced)
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        assert "names" in result

    @pytest.mark.asyncio
    async def test_ai_ext_006_fixture_response_parses_correctly(self, llm_extract_response):
        """Pre-recorded fixture is a valid entity extraction response."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content=llm_extract_response)
        chain = EntityExtractionChain(llm=mock_llm)
        result = await chain.run(text=_SAMPLE_TEXT)
        jsonschema.validate(instance=result, schema=ENTITY_SCHEMA)
        assert "Acme Corp" in result["names"]
