from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:19006"]

    # Downstream services
    STEER_SERVICE_URL: str = "http://steer-service:8001"
    SKILL_SERVICE_URL: str = "http://skill-service:8002"
    AUTH_SERVICE_URL: str = "http://auth-service:8003"
    AI_ORCHESTRATOR_URL: str = "http://ai-orchestrator:8004"
    DOCUMENT_SERVICE_URL: str = "http://document-service:8006"

    # JWT
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"

    # Redis (rate limiting)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Observability
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
