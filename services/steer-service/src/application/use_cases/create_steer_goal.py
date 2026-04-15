"""
Use Case: Create Steer Goal
Orchestrates domain logic, persistence, and event publishing.
"""

from uuid import UUID

from src.application.commands.steer_commands import CreateSteerGoalCommand
from src.application.dto.steer_dto import SteerGoalDTO
from src.domain.entities.steer_goal import SteerGoal
from src.domain.events.steer_events import SteerGoalCreated
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher


class CreateSteerGoalUseCase:
    def __init__(
        self,
        repository: ISteerGoalRepository,
        event_publisher: IEventPublisher,
    ):
        self._repository = repository
        self._event_publisher = event_publisher

    async def execute(self, command: CreateSteerGoalCommand) -> SteerGoalDTO:
        goal = SteerGoal(
            title=command.title,
            description=command.description,
            goal_type=command.goal_type,
            priority=command.priority,
            owner_id=command.owner_id,
            organization_id=command.organization_id,
            target_date=command.target_date,
            success_criteria=command.success_criteria,
        )

        saved_goal = await self._repository.save(goal)

        event = SteerGoalCreated(
            aggregate_id=saved_goal.id,
            goal_id=saved_goal.id,
            organization_id=saved_goal.organization_id,
            owner_id=saved_goal.owner_id,
            title=saved_goal.title,
            goal_type=saved_goal.goal_type,
        )
        await self._event_publisher.publish("steer.goal.created", event)

        return SteerGoalDTO.from_entity(saved_goal)
