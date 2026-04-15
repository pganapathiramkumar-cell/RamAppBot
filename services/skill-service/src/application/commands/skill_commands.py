from dataclasses import dataclass, field
from typing import Dict, List
from uuid import UUID

from src.domain.entities.skill import SkillCategory, ProficiencyLevel


@dataclass
class CreateSkillCommand:
    name: str
    description: str
    category: SkillCategory
    organization_id: UUID
    created_by: UUID
    proficiency_level: ProficiencyLevel = ProficiencyLevel.BEGINNER
    tags: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)


@dataclass
class SubmitSkillForReviewCommand:
    skill_id: UUID
    submitted_by: UUID


@dataclass
class ApproveSkillCommand:
    skill_id: UUID
    approved_by: UUID


@dataclass
class DeploySkillCommand:
    skill_id: UUID
    deployed_by: UUID


@dataclass
class DeprecateSkillCommand:
    skill_id: UUID
    reason: str
    deprecated_by: UUID


@dataclass
class UpdateSkillMetricsCommand:
    skill_id: UUID
    accuracy_score: float
    latency_ms: float
