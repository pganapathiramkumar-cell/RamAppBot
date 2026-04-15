"""
Unit tests: SummarizationChain
Blueprint refs: AI-SUM-001 → AI-SUM-004
All tests use pre-recorded LLM response fixtures — no real API calls.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.ai.chains.summarize import SummarizationChain, _TOKEN_THRESHOLD, _CHARS_PER_TOKEN
from src.ai.llm_client import LLMResponse
from src.core.exceptions import EmptyDocumentError

# Text calibrated to the threshold
_SHORT_DOC = "This is a short document. " * 50          # well under 4 000 tokens
_LONG_DOC  = "This is content for a very long document. " * 500  # over 4 000 tokens

assert len(_SHORT_DOC) // _CHARS_PER_TOKEN < _TOKEN_THRESHOLD
assert len(_LONG_DOC)  // _CHARS_PER_TOKEN >= _TOKEN_THRESHOLD


class TestSummarizationChain:
    """AI-SUM: Summarization chain tests."""

    @pytest.fixture
    def mock_llm(self):
        mock = AsyncMock()
        mock.ainvoke.return_value = LLMResponse(content="Mocked summary output.")
        return mock

    @pytest.mark.asyncio
    async def test_ai_sum_001_short_doc_uses_stuffing(self, mock_llm):
        """Short document (< 4000 tokens) uses the Stuffing strategy."""
        chain = SummarizationChain(llm=mock_llm)
        with patch.object(chain, "_stuffing_chain", wraps=chain._stuffing_chain) as spy_stuff, \
             patch.object(chain, "_map_reduce_chain", wraps=chain._map_reduce_chain) as spy_mr:
            await chain.run(text=_SHORT_DOC)
        spy_stuff.assert_called_once()
        spy_mr.assert_not_called()

    @pytest.mark.asyncio
    async def test_ai_sum_002_long_doc_uses_map_reduce(self, mock_llm):
        """Long document (≥ 4000 tokens) uses the Map-Reduce strategy."""
        chain = SummarizationChain(llm=mock_llm)
        with patch.object(chain, "_stuffing_chain", wraps=chain._stuffing_chain) as spy_stuff, \
             patch.object(chain, "_map_reduce_chain", wraps=chain._map_reduce_chain) as spy_mr:
            await chain.run(text=_LONG_DOC)
        spy_mr.assert_called_once()
        spy_stuff.assert_not_called()

    @pytest.mark.asyncio
    async def test_ai_sum_003_output_is_non_empty_string(self, mock_llm):
        """Regardless of doc length, chain always returns a non-empty string."""
        chain = SummarizationChain(llm=mock_llm)
        result = await chain.run(text=_SHORT_DOC)
        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_ai_sum_003_long_doc_output_is_non_empty_string(self, mock_llm):
        chain = SummarizationChain(llm=mock_llm)
        result = await chain.run(text=_LONG_DOC)
        assert isinstance(result, str)
        assert len(result.strip()) > 0

    @pytest.mark.asyncio
    async def test_ai_sum_004_empty_document_raises_empty_doc_error(self, mock_llm):
        """Blank text raises EmptyDocumentError, not a 500 crash."""
        chain = SummarizationChain(llm=mock_llm)
        with pytest.raises(EmptyDocumentError):
            await chain.run(text="")

    @pytest.mark.asyncio
    async def test_ai_sum_004_whitespace_only_raises_empty_doc_error(self, mock_llm):
        chain = SummarizationChain(llm=mock_llm)
        with pytest.raises(EmptyDocumentError):
            await chain.run(text="   \n\t  ")

    @pytest.mark.asyncio
    async def test_ai_sum_005_map_reduce_calls_llm_multiple_times(self, mock_llm):
        """Map-Reduce should call ainvoke at least twice (one map + one reduce)."""
        chain = SummarizationChain(llm=mock_llm)
        await chain.run(text=_LONG_DOC)
        assert mock_llm.ainvoke.call_count >= 2

    @pytest.mark.asyncio
    async def test_ai_sum_006_stuffing_calls_llm_exactly_once(self, mock_llm):
        """Stuffing strategy makes exactly one LLM call."""
        chain = SummarizationChain(llm=mock_llm)
        await chain.run(text=_SHORT_DOC)
        assert mock_llm.ainvoke.call_count == 1

    @pytest.mark.asyncio
    async def test_ai_sum_007_fixture_response_used_correctly(self, llm_summary_response):
        """Fixture content is returned verbatim as the summary."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content=llm_summary_response)
        chain = SummarizationChain(llm=mock_llm)
        result = await chain.run(text=_SHORT_DOC)
        assert result == llm_summary_response.strip()
