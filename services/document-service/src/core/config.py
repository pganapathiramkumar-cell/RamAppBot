"""Service configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SERVICE_NAME: str = "document-service"
    HOST: str = "0.0.0.0"
    PORT: int = 8006
    ENVIRONMENT: str = "development"

    # Security
    SUPABASE_JWT_SECRET: str = "test_secret_for_ci_only"
    SKIP_AUTH: bool = True          # set False in production

    # AI — LLM provider
    # Providers: "groq" (production/cloud), "ollama" (local dev), "mock" (CI/testing)
    LLM_PROVIDER: str = "groq"

    # Groq cloud — https://console.groq.com (free tier, Llama 3 models)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # NVIDIA NIM — https://build.nvidia.com (free credits, OpenAI-compatible)
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_MODEL: str = "meta/llama-3.1-8b-instruct"

    # Ollama local — only used when LLM_PROVIDER=ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # Storage
    CHROMA_PERSIST_PATH: str = "./chroma_db"

    # Limits
    MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024   # 5 MB
    MAX_UPLOADS_PER_HOUR: int = 10
    MAX_REQUESTS_PER_MINUTE: int = 100

    class Config:
        env_file = ".env"


settings = Settings()
