"""Use Case: Complete a Steer Goal (ACTIVE → COMPLETED)."""

from uuid import UUID

from src.application.dto.steer_dto import SteerGoalDTO
from src.domain.events.steer_events import SteerGoalCompleted
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.messaging.event_publisher import IEventPublisher


class CompleteSteerGoalUseCase:
    def __init__(self, repository: ISteerGoalRepository, event_publisher: IEventPublisher):
        self._repository = repository
        self._event_publisher = event_publisher

    async def execute(self, goal_id: UUID) -> SteerGoalDTO:
        goal = await self._repository.find_by_id(goal_id)
        if goal is None:
            raise ValueError(f"SteerGoal {goal_id} not found")

        goal.complete()
        saved = await self._repository.save(goal)

        event = SteerGoalCompleted(
            aggregate_id=saved.id,
            goal_id=saved.id,
            organization_id=saved.organization_id,
            final_alignment_score=saved.ai_alignment_score,
        )
        await self._event_publisher.publish("steer.goal.completed", event)

        return SteerGoalDTO.from_entity(saved)
