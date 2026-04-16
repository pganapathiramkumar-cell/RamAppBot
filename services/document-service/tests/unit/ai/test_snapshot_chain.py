import json
from unittest.mock import AsyncMock

import jsonschema
import pytest

from src.ai.chains.snapshot import DocumentSnapshotChain, SNAPSHOT_SCHEMA
from src.ai.llm_client import LLMResponse
from src.core.exceptions import ExtractionFailedError

_GOOD_RESPONSE = json.dumps({
    "primary_topic": "enterprise ai architecture",
    "secondary_topics": ["api gateway", "document workflow"],
    "word_count": 0,
    "key_ideas": ["gateway routes requests", "documents are processed asynchronously"],
    "important_entities": {
        "tools": ["Groq", "Mermaid"],
        "systems": ["API Gateway", "Document Service"],
        "metrics": ["5 MB"],
        "people": ["architect"],
        "organizations": ["RamBot"],
    },
    "relationships": ["API Gateway routes document requests"],
    "key_concepts": ["workflow", "analysis", "summary"],
})

_SAMPLE_TEXT = "RamBot document analysis routes uploads through a document service and generates summaries."


class TestDocumentSnapshotChain:
    @pytest.fixture
    def mock_llm(self):
        mock = AsyncMock()
        mock.ainvoke.return_value = LLMResponse(content=_GOOD_RESPONSE)
        return mock

    @pytest.mark.asyncio
    async def test_snapshot_output_validates_schema(self, mock_llm):
        chain = DocumentSnapshotChain(llm=mock_llm)
        result = await chain.run(_SAMPLE_TEXT)
        jsonschema.validate(instance=result, schema=SNAPSHOT_SCHEMA)

    @pytest.mark.asyncio
    async def test_snapshot_adds_real_word_count(self, mock_llm):
        chain = DocumentSnapshotChain(llm=mock_llm)
        result = await chain.run("One two three four")
        assert result["word_count"] == 4

    @pytest.mark.asyncio
    async def test_snapshot_retries_on_bad_json(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = [
            LLMResponse(content="{bad"),
            LLMResponse(content=_GOOD_RESPONSE),
        ]
        chain = DocumentSnapshotChain(llm=mock_llm, max_retries=2)
        result = await chain.run(_SAMPLE_TEXT)
        assert result["primary_topic"] == "enterprise ai architecture"

    @pytest.mark.asyncio
    async def test_snapshot_raises_after_max_retries(self):
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = LLMResponse(content="not json")
        chain = DocumentSnapshotChain(llm=mock_llm, max_retries=2)
        with pytest.raises(ExtractionFailedError):
            await chain.run(_SAMPLE_TEXT)
