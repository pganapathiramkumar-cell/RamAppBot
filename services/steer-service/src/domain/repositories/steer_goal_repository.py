"""
Domain Repository Interface for SteerGoal.
Defines the contract — infrastructure layer provides the implementation.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.entities.steer_goal import SteerGoal, SteerGoalStatus, SteerGoalType


class ISteerGoalRepository(ABC):

    @abstractmethod
    async def save(self, goal: SteerGoal) -> SteerGoal:
        ...

    @abstractmethod
    async def find_by_id(self, goal_id: UUID) -> Optional[SteerGoal]:
        ...

    @abstractmethod
    async def find_by_organization(
        self,
        organization_id: UUID,
        status: Optional[SteerGoalStatus] = None,
        goal_type: Optional[SteerGoalType] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SteerGoal]:
        ...

    @abstractmethod
    async def find_by_owner(self, owner_id: UUID) -> List[SteerGoal]:
        ...

    @abstractmethod
    async def delete(self, goal_id: UUID) -> None:
        ...

    @abstractmethod
    async def count_by_organization(self, organization_id: UUID) -> int:
        ...
