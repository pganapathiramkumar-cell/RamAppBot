# ADR-001: Microservices Architecture for Steer & Skill

**Date:** 2025-01-01
**Status:** Accepted

## Context
Rambot serves enterprise organizations where Steer (strategy) and Skill (capability) are distinct bounded contexts with separate teams, release cadences, and scaling needs.

## Decision
Adopt a microservices architecture with independent deployable services per bounded context, unified behind a single API Gateway.

## Consequences
**Positive:**
- Independent scaling of Steer vs. Skill based on load
- Teams own their service end-to-end (domain → infra → deployment)
- Failure isolation — Skill service outage does not affect Steer

**Negative:**
- Higher operational complexity (service discovery, distributed tracing)
- Network latency between services
- Mitigation: Docker Compose for local dev, K8s for production

## Alternatives Considered
- **Monolith**: Simpler initially but coupling between Steer/Skill domains would slow independent evolution
- **Modular Monolith**: Considered as an intermediate step but enterprise scale demands independent deployment
