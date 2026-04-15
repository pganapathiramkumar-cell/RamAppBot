"""SQLAlchemy ORM model for Skill."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase

from src.domain.entities.skill import SkillCategory, SkillStatus, ProficiencyLevel


class Base(DeclarativeBase):
    pass


class SkillModel(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False)
    category = Column(SAEnum(SkillCategory), nullable=False, index=True)
    status = Column(SAEnum(SkillStatus), nullable=False, default=SkillStatus.DRAFT, index=True)
    proficiency_level = Column(SAEnum(ProficiencyLevel), nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    tags = Column(JSON, default=list)
    metadata_ = Column("metadata", JSON, default=dict)
    accuracy_score = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
