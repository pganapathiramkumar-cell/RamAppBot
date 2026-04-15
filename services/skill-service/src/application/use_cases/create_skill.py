"""Use Case: Create Skill — orchestrates domain, AI enrichment, and event publishing."""

from src.application.commands.skill_commands import CreateSkillCommand
from src.application.dto.skill_dto import SkillDTO
from src.domain.entities.skill import Skill
from src.domain.events.skill_events import SkillCreated
from src.domain.repositories.skill_repository import ISkillRepository
from src.infrastructure.ai.skill_ai_client import SkillAIClient
from src.infrastructure.messaging.event_publisher import IEventPublisher


class CreateSkillUseCase:
    def __init__(
        self,
        repository: ISkillRepository,
        ai_client: SkillAIClient,
        event_publisher: IEventPublisher,
    ):
        self._repository = repository
        self._ai_client = ai_client
        self._event_publisher = event_publisher

    async def execute(self, command: CreateSkillCommand) -> SkillDTO:
        # Auto-enrich tags with AI if none provided
        tags = command.tags
        if not tags:
            try:
                tags = await self._ai_client.auto_tag_skill(command.name, command.description)
            except Exception:
                tags = []

        skill = Skill(
            name=command.name,
            description=command.description,
            category=command.category,
            organization_id=command.organization_id,
            created_by=command.created_by,
            proficiency_level=command.proficiency_level,
            tags=tags,
            metadata=command.metadata,
        )

        saved = await self._repository.save(skill)

        event = SkillCreated(
            aggregate_id=saved.id,
            skill_id=saved.id,
            organization_id=saved.organization_id,
            name=saved.name,
            category=saved.category,
        )
        await self._event_publisher.publish("skill.created", event)

        return SkillDTO.from_entity(saved)
