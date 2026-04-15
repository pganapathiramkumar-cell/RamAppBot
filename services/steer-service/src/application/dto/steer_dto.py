from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from src.domain.entities.steer_goal import SteerGoal, SteerGoalPriority, SteerGoalStatus, SteerGoalType


@dataclass
class SteerGoalDTO:
    id: UUID
    title: str
    description: str
    goal_type: SteerGoalType
    priority: SteerGoalPriority
    status: SteerGoalStatus
    owner_id: UUID
    organization_id: UUID
    ai_alignment_score: float
    success_criteria: List[str]
    target_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_overdue: bool

    @classmethod
    def from_entity(cls, goal: SteerGoal) -> "SteerGoalDTO":
        return cls(
            id=goal.id,
            title=goal.title,
            description=goal.description,
            goal_type=goal.goal_type,
            priority=goal.priority,
            status=goal.status,
            owner_id=goal.owner_id,
            organization_id=goal.organization_id,
            ai_alignment_score=goal.ai_alignment_score,
            success_criteria=goal.success_criteria,
            target_date=goal.target_date,
            created_at=goal.created_at,
            updated_at=goal.updated_at,
            is_overdue=goal.is_overdue(),
        )
