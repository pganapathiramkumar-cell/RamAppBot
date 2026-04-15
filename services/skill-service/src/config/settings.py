"""Skill Service configuration — reads from environment / .env file."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/skill_db"
    REDIS_URL: str = "redis://localhost:6379/1"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    PORT: int = 8002

    class Config:
        env_file = ".env"


settings = Settings()
