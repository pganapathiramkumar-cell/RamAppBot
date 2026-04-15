"""Use Case: Approve a Skill (UNDER_REVIEW → APPROVED)."""

from uuid import UUID

from src.application.dto.skill_dto import SkillDTO
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.cache.redis_cache import RedisCache
from src.infrastructure.messaging.event_publisher import IEventPublisher


class ApproveSkillUseCase:
    def __init__(
        self,
        repository: ISkillRepository,
        event_publisher: IEventPublisher,
        cache: RedisCache,
    ):
        self._repository = repository
        self._event_publisher = event_publisher
        self._cache = cache

    async def execute(self, skill_id: UUID) -> SkillDTO:
        skill = await self._repository.find_by_id(skill_id)
        if skill is None:
            raise ValueError(f"Skill {skill_id} not found")

        skill.approve()
        saved = await self._repository.save(skill)

        await self._cache.delete(f"skill:id:{skill_id}")
        await self._cache.invalidate_pattern(f"skill:list:{saved.organization_id}:*")

        return SkillDTO.from_entity(saved)
