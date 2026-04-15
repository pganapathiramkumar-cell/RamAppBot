"""
Domain Entity: Skill
Represents an AI capability or competency within the enterprise.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID, uuid4


class SkillCategory(str, Enum):
    NLP = "nlp"
    COMPUTER_VISION = "computer_vision"
    DATA_ANALYSIS = "data_analysis"
    REASONING = "reasoning"
    CODE_GENERATION = "code_generation"
    MULTIMODAL = "multimodal"
    AGENT = "agent"
    CUSTOM = "custom"


class SkillStatus(str, Enum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DEPLOYED = "deployed"
    DEPRECATED = "deprecated"


class ProficiencyLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


@dataclass
class SkillVersion:
    version: str
    changelog: str
    released_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Skill:
    name: str
    description: str
    category: SkillCategory
    organization_id: UUID
    created_by: UUID
    id: UUID = field(default_factory=uuid4)
    status: SkillStatus = SkillStatus.DRAFT
    proficiency_level: ProficiencyLevel = ProficiencyLevel.BEGINNER
    tags: List[str] = field(default_factory=list)
    versions: List[SkillVersion] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)
    # AI evaluation metrics
    accuracy_score: float = 0.0
    latency_ms: float = 0.0
    usage_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def approve(self) -> None:
        if self.status != SkillStatus.UNDER_REVIEW:
            raise ValueError("Only skills under review can be approved")
        self.status = SkillStatus.APPROVED
        self.updated_at = datetime.utcnow()

    def deploy(self) -> None:
        if self.status != SkillStatus.APPROVED:
            raise ValueError("Only approved skills can be deployed")
        self.status = SkillStatus.DEPLOYED
        self.updated_at = datetime.utcnow()

    def deprecate(self) -> None:
        if self.status == SkillStatus.DEPRECATED:
            raise ValueError("Skill is already deprecated")
        self.status = SkillStatus.DEPRECATED
        self.updated_at = datetime.utcnow()

    def submit_for_review(self) -> None:
        if self.status != SkillStatus.DRAFT:
            raise ValueError("Only draft skills can be submitted for review")
        self.status = SkillStatus.UNDER_REVIEW
        self.updated_at = datetime.utcnow()

    def add_version(self, version: str, changelog: str) -> None:
        self.versions.append(SkillVersion(version=version, changelog=changelog))
        self.updated_at = datetime.utcnow()

    def increment_usage(self) -> None:
        self.usage_count += 1
        self.updated_at = datetime.utcnow()

    def update_metrics(self, accuracy_score: float, latency_ms: float) -> None:
        if not 0.0 <= accuracy_score <= 1.0:
            raise ValueError("Accuracy score must be 0.0–1.0")
        self.accuracy_score = accuracy_score
        self.latency_ms = latency_ms
        self.updated_at = datetime.utcnow()
