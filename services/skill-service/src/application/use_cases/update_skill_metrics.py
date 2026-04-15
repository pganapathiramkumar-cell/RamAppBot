"""Use Case: Update AI evaluation metrics for a Skill."""

from uuid import UUID

from src.application.commands.skill_commands import UpdateSkillMetricsCommand
from src.application.dto.skill_dto import SkillDTO
from src.domain.events.skill_events import SkillMetricsUpdated
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.cache.redis_cache import RedisCache
from src.infrastructure.messaging.event_publisher import IEventPublisher


class UpdateSkillMetricsUseCase:
    def __init__(
        self,
        repository: ISkillRepository,
        event_publisher: IEventPublisher,
        cache: RedisCache,
    ):
        self._repository = repository
        self._event_publisher = event_publisher
        self._cache = cache

    async def execute(self, command: UpdateSkillMetricsCommand) -> SkillDTO:
        skill = await self._repository.find_by_id(command.skill_id)
        if skill is None:
            raise ValueError(f"Skill {command.skill_id} not found")

        skill.update_metrics(command.accuracy_score, command.latency_ms)
        saved = await self._repository.save(skill)

        event = SkillMetricsUpdated(
            aggregate_id=saved.id,
            skill_id=saved.id,
            accuracy_score=saved.accuracy_score,
            latency_ms=saved.latency_ms,
        )
        await self._event_publisher.publish("skill.metrics.updated", event)

        await self._cache.delete(f"skill:id:{command.skill_id}")
        await self._cache.invalidate_pattern(f"skill:list:{saved.organization_id}:*")

        return SkillDTO.from_entity(saved)
