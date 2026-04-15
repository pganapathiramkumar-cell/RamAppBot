from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from src.domain.entities.steer_goal import SteerGoalPriority, SteerGoalType


@dataclass
class CreateSteerGoalCommand:
    title: str
    description: str
    goal_type: SteerGoalType
    priority: SteerGoalPriority
    owner_id: UUID
    organization_id: UUID
    target_date: Optional[datetime] = None
    success_criteria: List[str] = field(default_factory=list)


@dataclass
class ActivateSteerGoalCommand:
    goal_id: UUID
    requested_by: UUID


@dataclass
class CompleteSteerGoalCommand:
    goal_id: UUID
    requested_by: UUID


@dataclass
class UpdateAlignmentScoreCommand:
    goal_id: UUID
    score: float
