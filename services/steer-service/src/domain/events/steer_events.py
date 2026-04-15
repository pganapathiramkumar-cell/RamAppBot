"""
Domain Events for the Steer bounded context.
Published to message broker when state changes occur.
"""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    occurred_at: datetime = field(default_factory=datetime.utcnow)
    aggregate_id: UUID = field(default=None)


@dataclass
class SteerGoalCreated(DomainEvent):
    goal_id: UUID = None
    organization_id: UUID = None
    owner_id: UUID = None
    title: str = ""
    goal_type: str = ""


@dataclass
class SteerGoalActivated(DomainEvent):
    goal_id: UUID = None
    organization_id: UUID = None


@dataclass
class SteerGoalCompleted(DomainEvent):
    goal_id: UUID = None
    organization_id: UUID = None
    final_alignment_score: float = 0.0


@dataclass
class SteerGoalAlignmentUpdated(DomainEvent):
    goal_id: UUID = None
    old_score: float = 0.0
    new_score: float = 0.0
