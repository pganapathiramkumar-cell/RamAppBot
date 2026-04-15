from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.entities.skill import Skill, SkillCategory, SkillStatus


class ISkillRepository(ABC):

    @abstractmethod
    async def save(self, skill: Skill) -> Skill:
        ...

    @abstractmethod
    async def find_by_id(self, skill_id: UUID) -> Optional[Skill]:
        ...

    @abstractmethod
    async def find_by_organization(
        self,
        organization_id: UUID,
        category: Optional[SkillCategory] = None,
        status: Optional[SkillStatus] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Skill]:
        ...

    @abstractmethod
    async def find_by_name(self, name: str, organization_id: UUID) -> Optional[Skill]:
        ...

    @abstractmethod
    async def search(self, query: str, organization_id: UUID) -> List[Skill]:
        ...

    @abstractmethod
    async def delete(self, skill_id: UUID) -> None:
        ...
