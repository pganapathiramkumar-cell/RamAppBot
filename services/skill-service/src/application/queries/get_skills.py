"""Queries for Skill read operations."""

from typing import List, Optional
from uuid import UUID

from src.application.dto.skill_dto import SkillDTO
from src.domain.entities.skill import SkillCategory, SkillStatus
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.cache.redis_cache import RedisCache


class GetSkillsQuery:
    def __init__(self, repository: ISkillRepository, cache: RedisCache):
        self._repository = repository
        self._cache = cache

    async def execute(
        self,
        organization_id: UUID,
        category: Optional[SkillCategory] = None,
        status: Optional[SkillStatus] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SkillDTO]:
        cat_key = category.value if category else "all"
        status_key = status.value if status else "all"
        tags_key = ",".join(sorted(tags)) if tags else "all"
        cache_key = f"skill:list:{organization_id}:{cat_key}:{status_key}:{tags_key}:{limit}:{offset}"

        cached = await self._cache.get(cache_key)
        if cached:
            return [SkillDTO(**item) for item in cached]

        skills = await self._repository.find_by_organization(
            organization_id, category=category, status=status, tags=tags, limit=limit, offset=offset
        )
        dtos = [SkillDTO.from_entity(s) for s in skills]
        await self._cache.set(cache_key, [dto.__dict__ for dto in dtos], ttl=60)
        return dtos


class GetSkillByIdQuery:
    def __init__(self, repository: ISkillRepository, cache: RedisCache):
        self._repository = repository
        self._cache = cache

    async def execute(self, skill_id: UUID) -> Optional[SkillDTO]:
        cache_key = f"skill:id:{skill_id}"
        cached = await self._cache.get(cache_key)
        if cached:
            return SkillDTO(**cached)

        skill = await self._repository.find_by_id(skill_id)
        if not skill:
            return None
        dto = SkillDTO.from_entity(skill)
        await self._cache.set(cache_key, dto.__dict__, ttl=120)
        return dto


class SearchSkillsQuery:
    def __init__(self, repository: ISkillRepository):
        self._repository = repository

    async def execute(self, query: str, organization_id: UUID) -> List[SkillDTO]:
        skills = await self._repository.search(query, organization_id)
        return [SkillDTO.from_entity(s) for s in skills]
