from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8004
    ENVIRONMENT: str = "development"

    # Local Llama via Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"          # run: ollama pull llama3.2
    AI_MAX_TOKENS: int = 4096               # kept for logging/reference only

    REDIS_URL: str = "redis://localhost:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"
    STEER_SERVICE_URL: str = "http://steer-service:8001"
    SKILL_SERVICE_URL: str = "http://skill-service:8002"

    class Config:
        env_file = ".env"


settings = Settings()
