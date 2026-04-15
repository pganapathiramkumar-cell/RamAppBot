"""Use Case: Activate a Steer Goal (DRAFT → ACTIVE)."""

from uuid import UUID

from src.application.dto.steer_dto import SteerGoalDTO
from src.domain.events.steer_events import SteerGoalActivated
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher


class ActivateSteerGoalUseCase:
    def __init__(self, repository: ISteerGoalRepository, event_publisher: IEventPublisher):
        self._repository = repository
        self._event_publisher = event_publisher

    async def execute(self, goal_id: UUID) -> SteerGoalDTO:
        goal = await self._repository.find_by_id(goal_id)
        if goal is None:
            raise ValueError(f"SteerGoal {goal_id} not found")

        goal.activate()
        saved = await self._repository.save(goal)

        event = SteerGoalActivated(
            aggregate_id=saved.id,
            goal_id=saved.id,
            organization_id=saved.organization_id,
        )
        await self._event_publisher.publish("steer.goal.activated", event)

        return SteerGoalDTO.from_entity(saved)
