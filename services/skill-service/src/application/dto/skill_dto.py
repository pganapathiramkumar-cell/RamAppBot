from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List
from uuid import UUID

from src.domain.entities.skill import Skill, SkillCategory, SkillStatus, ProficiencyLevel


@dataclass
class SkillDTO:
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
    def from_entity(cls, skill: Skill) -> "SkillDTO":
        return cls(
            id=skill.id,
            name=skill.name,
            description=skill.description,
            category=skill.category,
            status=skill.status,
            proficiency_level=skill.proficiency_level,
            organization_id=skill.organization_id,
            created_by=skill.created_by,
            tags=skill.tags,
            accuracy_score=skill.accuracy_score,
            latency_ms=skill.latency_ms,
            usage_count=skill.usage_count,
            metadata=skill.metadata,
            created_at=skill.created_at,
            updated_at=skill.updated_at,
        )
