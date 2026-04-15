# ADR-002: Claude (Anthropic) as Primary AI Model

**Date:** 2025-01-01
**Status:** Accepted

## Context
The platform requires AI for: alignment scoring, strategic recommendations, skill evaluation, and natural language analysis. Model selection impacts quality, cost, and latency.

## Decision
Use **Claude Sonnet 4.6** (`claude-sonnet-4-6`) as the primary model via the Anthropic API, accessed through the AI Orchestrator service. Tool use (function calling) is used for structured data retrieval within agent loops.

## Consequences
**Positive:**
- Superior reasoning and instruction-following for enterprise analysis
- Native tool use enables reliable structured output
- Long context window handles full goal/skill catalogs
- Safety features align with enterprise compliance requirements

**Negative:**
- API cost at scale — mitigated by Redis caching of stable results
- External dependency — mitigated by abstracting behind `IEventPublisher`-style interfaces

## Model Configuration
- **Alignment scoring**: `max_tokens=50` (JSON only)
- **Recommendations**: `max_tokens=500`
- **Agent loops (Steer/Skill agents)**: `max_tokens=2048`
