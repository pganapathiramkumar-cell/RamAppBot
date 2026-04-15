"""Use Case: Deprecate a Skill (any → DEPRECATED)."""

from uuid import UUID

from src.application.dto.skill_dto import SkillDTO
from src.domain.events.skill_events import SkillDeprecated
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.cache.redis_cache import RedisCache
from src.infrastructure.messaging.event_publisher import IEventPublisher


class DeprecateSkillUseCase:
    def __init__(
        self,
        repository: ISkillRepository,
        event_publisher: IEventPublisher,
        cache: RedisCache,
    ):
        self._repository = repository
        self._event_publisher = event_publisher
        self._cache = cache

    async def execute(self, skill_id: UUID, reason: str) -> SkillDTO:
        skill = await self._repository.find_by_id(skill_id)
        if skill is None:
            raise ValueError(f"Skill {skill_id} not found")

        skill.deprecate()
        saved = await self._repository.save(skill)

        event = SkillDeprecated(
            aggregate_id=saved.id,
            skill_id=saved.id,
            organization_id=saved.organization_id,
            reason=reason,
        )
        await self._event_publisher.publish("skill.deprecated", event)

        await self._cache.delete(f"skill:id:{skill_id}")
        await self._cache.invalidate_pattern(f"skill:list:{saved.organization_id}:*")

        return SkillDTO.from_entity(saved)
