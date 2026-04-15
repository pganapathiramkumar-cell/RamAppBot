"""Queries for Skill read operations."""

from typing import List, Optional
from uuid import UUID

from src.application.dto.skill_dto import SkillDTO
from src.domain.entities.skill import SkillCategory, SkillStatus
from src.domain.repositories.skill_repository import ISkillRepository


class GetSkillsQuery:
    def __init__(self, repository: ISkillRepository):
        self._repository = repository

    async def execute(
        self,
        organization_id: UUID,
        category: Optional[SkillCategory] = None,
        status: Optional[SkillStatus] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SkillDTO]:
        skills = await self._repository.find_by_organization(
            organization_id, category=category, status=status, tags=tags, limit=limit, offset=offset
        )
        return [SkillDTO.from_entity(s) for s in skills]


class GetSkillByIdQuery:
    def __init__(self, repository: ISkillRepository):
        self._repository = repository

    async def execute(self, skill_id: UUID) -> Optional[SkillDTO]:
        skill = await self._repository.find_by_id(skill_id)
        return SkillDTO.from_entity(skill) if skill else None


class SearchSkillsQuery:
    def __init__(self, repository: ISkillRepository):
        self._repository = repository

    async def execute(self, query: str, organization_id: UUID) -> List[SkillDTO]:
        skills = await self._repository.search(query, organization_id)
        return [SkillDTO.from_entity(s) for s in skills]
