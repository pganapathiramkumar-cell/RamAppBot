from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from src.domain.entities.steer_goal import SteerGoalPriority, SteerGoalStatus, SteerGoalType
from src.application.dto.steer_dto import SteerGoalDTO


class CreateSteerGoalRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    goal_type: SteerGoalType
    priority: SteerGoalPriority
    owner_id: UUID
    organization_id: UUID
    target_date: Optional[datetime] = None
    success_criteria: List[str] = Field(default_factory=list, max_length=10)

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Achieve 90% AI Model Accuracy",
                "description": "Ensure all production AI models meet 90% accuracy threshold by Q3.",
                "goal_type": "strategic",
                "priority": "high",
                "owner_id": "123e4567-e89b-12d3-a456-426614174000",
                "organization_id": "223e4567-e89b-12d3-a456-426614174000",
                "target_date": "2025-09-30T00:00:00Z",
                "success_criteria": ["Model accuracy >= 90%", "Latency < 200ms"]
            }
        }


class UpdateSteerGoalRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    priority: Optional[SteerGoalPriority] = None
    target_date: Optional[datetime] = None
    success_criteria: Optional[List[str]] = Field(None, max_length=10)


class SteerGoalResponse(BaseModel):
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
    def from_dto(cls, dto: SteerGoalDTO) -> "SteerGoalResponse":
        return cls(**dto.__dict__)
