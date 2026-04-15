"""Use Case: Deploy a Skill (APPROVED → DEPLOYED)."""

from uuid import UUID

from src.application.dto.skill_dto import SkillDTO
from src.domain.events.skill_events import SkillDeployed
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher


class DeploySkillUseCase:
    def __init__(self, repository: ISkillRepository, event_publisher: IEventPublisher):
        self._repository = repository
        self._event_publisher = event_publisher

    async def execute(self, skill_id: UUID) -> SkillDTO:
        skill = await self._repository.find_by_id(skill_id)
        if skill is None:
            raise ValueError(f"Skill {skill_id} not found")

        skill.deploy()
        saved = await self._repository.save(skill)

        event = SkillDeployed(
            aggregate_id=saved.id,
            skill_id=saved.id,
            organization_id=saved.organization_id,
        )
        await self._event_publisher.publish("skill.deployed", event)

        return SkillDTO.from_entity(saved)
