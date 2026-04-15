from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from src.domain.entities.skill import SkillCategory, SkillStatus, ProficiencyLevel
from src.application.dto.skill_dto import SkillDTO


class CreateSkillRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    category: SkillCategory
    organization_id: UUID
    created_by: UUID
    proficiency_level: ProficiencyLevel = ProficiencyLevel.BEGINNER
    tags: List[str] = Field(default_factory=list)
    metadata: Dict = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Conversational NLP Pipeline",
                "description": "Production-grade NLP pipeline for intent detection and entity extraction.",
                "category": "nlp",
                "organization_id": "123e4567-e89b-12d3-a456-426614174000",
                "created_by": "223e4567-e89b-12d3-a456-426614174000",
                "proficiency_level": "advanced",
                "tags": ["nlp", "intent", "entity-extraction"]
            }
        }


class UpdateSkillMetricsRequest(BaseModel):
    accuracy_score: float = Field(..., ge=0.0, le=1.0)
    latency_ms: float = Field(..., ge=0.0)


class SkillResponse(BaseModel):
    id: UUID
    name: str
    description: str
    category: SkillCategory
    status: SkillStatus
    proficiency_level: ProficiencyLevel
    organization_id: UUID
    created_by: UUID
    tags: List[str]
    accuracy_score: float
    latency_ms: float
    usage_count: int
    metadata: Dict
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_dto(cls, dto: SkillDTO) -> "SkillResponse":
        return cls(**dto.__dict__)
