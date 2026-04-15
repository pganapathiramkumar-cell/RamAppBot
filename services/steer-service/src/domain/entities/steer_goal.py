"""
Domain Entity: SteerGoal
Represents a strategic AI steering goal within the enterprise.
Pure domain logic — no framework dependencies.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4


class SteerGoalStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class SteerGoalPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SteerGoalType(str, Enum):
    STRATEGIC = "strategic"       # Enterprise-wide AI direction
    OPERATIONAL = "operational"   # Day-to-day AI guidance
    COMPLIANCE = "compliance"     # Governance & regulatory
    INNOVATION = "innovation"     # R&D and experimentation


@dataclass
class SteerGoal:
    title: str
    description: str
    goal_type: SteerGoalType
    priority: SteerGoalPriority
    owner_id: UUID
    organization_id: UUID
    id: UUID = field(default_factory=uuid4)
    status: SteerGoalStatus = SteerGoalStatus.DRAFT
    target_date: Optional[datetime] = None
    success_criteria: list[str] = field(default_factory=list)
    ai_alignment_score: float = 0.0   # 0.0 – 1.0, computed by AI Orchestrator
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def activate(self) -> None:
        if self.status != SteerGoalStatus.DRAFT:
            raise ValueError(f"Cannot activate goal in status: {self.status}")
        self.status = SteerGoalStatus.ACTIVE
        self.updated_at = datetime.utcnow()

    def complete(self) -> None:
        if self.status != SteerGoalStatus.ACTIVE:
            raise ValueError("Only active goals can be completed")
        self.status = SteerGoalStatus.COMPLETED
        self.updated_at = datetime.utcnow()

    def update_alignment_score(self, score: float) -> None:
        if not 0.0 <= score <= 1.0:
            raise ValueError("Alignment score must be between 0.0 and 1.0")
        self.ai_alignment_score = score
        self.updated_at = datetime.utcnow()

    def is_overdue(self) -> bool:
        if self.target_date is None:
            return False
        return self.status == SteerGoalStatus.ACTIVE and datetime.utcnow() > self.target_date
