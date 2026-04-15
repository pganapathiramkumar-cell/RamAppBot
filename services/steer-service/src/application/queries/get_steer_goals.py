"""Query: List steer goals for an organization (with optional cache)."""

from typing import List, Optional
from uuid import UUID

from src.application.dto.steer_dto import SteerGoalDTO
from src.domain.entities.steer_goal import SteerGoalStatus, SteerGoalType
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.cache.redis_cache import RedisCache


class GetSteerGoalsQuery:
    def __init__(self, repository: ISteerGoalRepository, cache: RedisCache):
        self._repository = repository
        self._cache = cache

    async def execute(
        self,
        organization_id: UUID,
        status: Optional[SteerGoalStatus] = None,
        goal_type: Optional[SteerGoalType] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SteerGoalDTO]:
        cache_key = f"steer:goals:{organization_id}:{status}:{goal_type}:{limit}:{offset}"
        cached = await self._cache.get(cache_key)
        if cached:
            return [SteerGoalDTO(**item) for item in cached]

        goals = await self._repository.find_by_organization(
            organization_id, status=status, goal_type=goal_type, limit=limit, offset=offset
        )
        dtos = [SteerGoalDTO.from_entity(g) for g in goals]
        await self._cache.set(cache_key, [dto.__dict__ for dto in dtos], ttl=60)
        return dtos


class GetSteerGoalByIdQuery:
    def __init__(self, repository: ISteerGoalRepository):
        self._repository = repository

    async def execute(self, goal_id: UUID) -> Optional[SteerGoalDTO]:
        goal = await self._repository.find_by_id(goal_id)
        return SteerGoalDTO.from_entity(goal) if goal else None
