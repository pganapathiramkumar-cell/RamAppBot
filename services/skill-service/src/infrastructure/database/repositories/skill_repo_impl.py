"""PostgreSQL implementation of ISkillRepository."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.skill import Skill, SkillCategory, SkillStatus
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.database.models.skill_model import SkillModel


class PostgresSkillRepository(ISkillRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, skill: Skill) -> Skill:
        model = await self._session.get(SkillModel, skill.id)
        if model is None:
            model = SkillModel()
        self._to_model(skill, model)
        self._session.add(model)
        await self._session.flush()
        return self._to_entity(model)

    async def find_by_id(self, skill_id: UUID) -> Optional[Skill]:
        model = await self._session.get(SkillModel, skill_id)
        return self._to_entity(model) if model else None

    async def find_by_organization(
        self,
        organization_id: UUID,
        category: Optional[SkillCategory] = None,
        status: Optional[SkillStatus] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Skill]:
        stmt = select(SkillModel).where(SkillModel.organization_id == organization_id)
        if category:
            stmt = stmt.where(SkillModel.category == category)
        if status:
            stmt = stmt.where(SkillModel.status == status)
        stmt = stmt.order_by(SkillModel.created_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def find_by_name(self, name: str, organization_id: UUID) -> Optional[Skill]:
        stmt = select(SkillModel).where(SkillModel.name == name, SkillModel.organization_id == organization_id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def search(self, query: str, organization_id: UUID) -> List[Skill]:
        stmt = select(SkillModel).where(
            SkillModel.organization_id == organization_id,
            or_(
                SkillModel.name.ilike(f"%{query}%"),
                SkillModel.description.ilike(f"%{query}%"),
            )
        ).limit(20)
        result = await self._session.execute(stmt)
        return [self._to_entity(m) for m in result.scalars().all()]

    async def delete(self, skill_id: UUID) -> None:
        model = await self._session.get(SkillModel, skill_id)
        if model:
            await self._session.delete(model)

    @staticmethod
    def _to_model(entity: Skill, model: SkillModel) -> None:
        model.id = entity.id
        model.name = entity.name
        model.description = entity.description
        model.category = entity.category
        model.status = entity.status
        model.proficiency_level = entity.proficiency_level
        model.organization_id = entity.organization_id
        model.created_by = entity.created_by
        model.tags = entity.tags
        model.metadata_ = entity.metadata
        model.accuracy_score = entity.accuracy_score
        model.latency_ms = entity.latency_ms
        model.usage_count = entity.usage_count
        model.created_at = entity.created_at
        model.updated_at = entity.updated_at

    @staticmethod
    def _to_entity(model: SkillModel) -> Skill:
        return Skill(
            id=model.id,
            name=model.name,
            description=model.description,
            category=model.category,
            status=model.status,
            proficiency_level=model.proficiency_level,
            organization_id=model.organization_id,
            created_by=model.created_by,
            tags=model.tags or [],
            metadata=model.metadata_ or {},
            accuracy_score=model.accuracy_score,
            latency_ms=model.latency_ms,
            usage_count=model.usage_count,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
