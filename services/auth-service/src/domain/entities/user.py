"""Domain Entity: User."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    AI_ARCHITECT = "ai_architect"
    ANALYST = "analyst"
    VIEWER = "viewer"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


@dataclass
class User:
    email: str
    full_name: str
    organization_id: UUID
    hashed_password: str
    id: UUID = field(default_factory=uuid4)
    role: UserRole = UserRole.ANALYST
    status: UserStatus = UserStatus.ACTIVE
    is_email_verified: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    last_login_at: datetime | None = None

    def verify_email(self) -> None:
        self.is_email_verified = True
        self.updated_at = datetime.utcnow()

    def suspend(self) -> None:
        self.status = UserStatus.SUSPENDED
        self.updated_at = datetime.utcnow()

    def record_login(self) -> None:
        self.last_login_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
