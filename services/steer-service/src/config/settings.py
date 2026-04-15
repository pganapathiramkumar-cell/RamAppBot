"""Steer Service configuration — reads from environment / .env file."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/steer_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"
    PORT: int = 8001

    # LLM — multi-provider fallback chain (Groq → NVIDIA → Cerebras → Mock)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_MODEL: str = "meta/llama-3.1-8b-instruct"
    CEREBRAS_API_KEY: str = ""
    CEREBRAS_MODEL: str = "llama3.1-70b"

    class Config:
        env_file = ".env"


settings = Settings()
