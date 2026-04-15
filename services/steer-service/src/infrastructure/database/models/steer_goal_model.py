"""SQLAlchemy ORM model for SteerGoal — infrastructure concern only."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase

from src.domain.entities.steer_goal import SteerGoalStatus, SteerGoalPriority, SteerGoalType


class Base(DeclarativeBase):
    pass


class SteerGoalModel(Base):
    __tablename__ = "steer_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False)
    goal_type = Column(SAEnum(SteerGoalType), nullable=False)
    priority = Column(SAEnum(SteerGoalPriority), nullable=False)
    status = Column(SAEnum(SteerGoalStatus), nullable=False, default=SteerGoalStatus.DRAFT)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    target_date = Column(DateTime, nullable=True)
    success_criteria = Column(JSON, default=list)
    ai_alignment_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
