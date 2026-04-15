"""Use Case: Login — validates credentials and issues JWT tokens."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class LoginCommand:
    email: str
    password: str


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class LoginUseCase:
    def __init__(self, user_repository, jwt_secret: str, jwt_algorithm: str = "HS256"):
        self._repo = user_repository
        self._secret = jwt_secret
        self._algorithm = jwt_algorithm

    async def execute(self, command: LoginCommand) -> TokenPair:
        user = await self._repo.find_by_email(command.email)
        if not user or not pwd_context.verify(command.password, user.hashed_password):
            raise ValueError("Invalid email or password")

        if user.status.value != "active":
            raise ValueError("Account is not active")

        user.record_login()
        await self._repo.save(user)

        now = datetime.utcnow()
        access_payload = {
            "sub": str(user.id),
            "email": user.email,
            "org_id": str(user.organization_id),
            "roles": [user.role.value],
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        refresh_payload = {
            "sub": str(user.id),
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=7),
        }

        return TokenPair(
            access_token=jwt.encode(access_payload, self._secret, algorithm=self._algorithm),
            refresh_token=jwt.encode(refresh_payload, self._secret, algorithm=self._algorithm),
        )
