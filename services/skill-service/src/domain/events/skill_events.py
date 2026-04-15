"""Domain Events for the Skill bounded context."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    occurred_at: datetime = field(default_factory=datetime.utcnow)
    aggregate_id: UUID = field(default=None)


@dataclass
class SkillCreated(DomainEvent):
    skill_id: UUID = None
    organization_id: UUID = None
    name: str = ""
    category: str = ""


@dataclass
class SkillSubmittedForReview(DomainEvent):
    skill_id: UUID = None
    organization_id: UUID = None


@dataclass
class SkillDeployed(DomainEvent):
    skill_id: UUID = None
    organization_id: UUID = None


@dataclass
class SkillDeprecated(DomainEvent):
    skill_id: UUID = None
    organization_id: UUID = None
    reason: str = ""


@dataclass
class SkillMetricsUpdated(DomainEvent):
    skill_id: UUID = None
    accuracy_score: float = 0.0
    latency_ms: float = 0.0
