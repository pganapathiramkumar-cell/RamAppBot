"""Use Case: Update an existing Steer Goal (title, description, priority, target_date, criteria)."""

from datetime import datetime
from uuid import UUID

from src.application.commands.steer_commands import UpdateSteerGoalCommand
from src.application.dto.steer_dto import SteerGoalDTO
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.cache.redis_cache import RedisCache


class UpdateSteerGoalUseCase:
    def __init__(self, repository: ISteerGoalRepository, cache: RedisCache):
        self._repository = repository
        self._cache = cache

    async def execute(self, command: UpdateSteerGoalCommand) -> SteerGoalDTO:
        goal = await self._repository.find_by_id(command.goal_id)
        if goal is None:
            raise ValueError(f"SteerGoal {command.goal_id} not found")

        if command.title is not None:
            goal.title = command.title
        if command.description is not None:
            goal.description = command.description
        if command.priority is not None:
            goal.priority = command.priority
        if command.target_date is not None:
            goal.target_date = command.target_date
        if command.success_criteria is not None:
            goal.success_criteria = command.success_criteria

        goal.updated_at = datetime.utcnow()
        saved = await self._repository.save(goal)

        # Invalidate cached list entries for this org
        await self._cache.invalidate_pattern(f"steer:goals:{saved.organization_id}:*")

        return SteerGoalDTO.from_entity(saved)
