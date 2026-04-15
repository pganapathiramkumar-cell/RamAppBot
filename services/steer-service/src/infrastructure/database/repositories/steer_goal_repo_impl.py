"""PostgreSQL implementation of ISteerGoalRepository using SQLAlchemy async."""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.entities.steer_goal import SteerGoal, SteerGoalStatus, SteerGoalType
from src.domain.repositories.steer_goal_repository import ISteerGoalRepository
from src.infrastructure.database.models.steer_goal_model import SteerGoalModel


class PostgresSteerGoalRepository(ISteerGoalRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, goal: SteerGoal) -> SteerGoal:
        model = await self._session.get(SteerGoalModel, goal.id)
        if model is None:
            model = SteerGoalModel()
        self._map_entity_to_model(goal, model)
        self._session.add(model)
        await self._session.flush()
        return self._map_model_to_entity(model)

    async def find_by_id(self, goal_id: UUID) -> Optional[SteerGoal]:
        model = await self._session.get(SteerGoalModel, goal_id)
        return self._map_model_to_entity(model) if model else None

    async def find_by_organization(
        self,
        organization_id: UUID,
        status: Optional[SteerGoalStatus] = None,
        goal_type: Optional[SteerGoalType] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SteerGoal]:
        stmt = select(SteerGoalModel).where(SteerGoalModel.organization_id == organization_id)
        if status:
            stmt = stmt.where(SteerGoalModel.status == status)
        if goal_type:
            stmt = stmt.where(SteerGoalModel.goal_type == goal_type)
        stmt = stmt.order_by(SteerGoalModel.created_at.desc()).limit(limit).offset(offset)
        result = await self._session.execute(stmt)
        return [self._map_model_to_entity(m) for m in result.scalars().all()]

    async def find_by_owner(self, owner_id: UUID) -> List[SteerGoal]:
        stmt = select(SteerGoalModel).where(SteerGoalModel.owner_id == owner_id)
        result = await self._session.execute(stmt)
        return [self._map_model_to_entity(m) for m in result.scalars().all()]

    async def delete(self, goal_id: UUID) -> None:
        model = await self._session.get(SteerGoalModel, goal_id)
        if model:
            await self._session.delete(model)

    async def count_by_organization(self, organization_id: UUID) -> int:
        stmt = select(func.count()).where(SteerGoalModel.organization_id == organization_id)
        result = await self._session.execute(stmt)
        return result.scalar_one()

    @staticmethod
    def _map_entity_to_model(entity: SteerGoal, model: SteerGoalModel) -> None:
        model.id = entity.id
        model.title = entity.title
        model.description = entity.description
        model.goal_type = entity.goal_type
        model.priority = entity.priority
        model.status = entity.status
        model.owner_id = entity.owner_id
        model.organization_id = entity.organization_id
        model.target_date = entity.target_date
        model.success_criteria = entity.success_criteria
        model.ai_alignment_score = entity.ai_alignment_score
        model.created_at = entity.created_at
        model.updated_at = entity.updated_at

    @staticmethod
    def _map_model_to_entity(model: SteerGoalModel) -> SteerGoal:
        return SteerGoal(
            id=model.id,
            title=model.title,
            description=model.description,
            goal_type=model.goal_type,
            priority=model.priority,
            status=model.status,
            owner_id=model.owner_id,
            organization_id=model.organization_id,
            target_date=model.target_date,
            success_criteria=model.success_criteria or [],
            ai_alignment_score=model.ai_alignment_score,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
