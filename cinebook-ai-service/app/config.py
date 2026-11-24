import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Application Info
    APP_NAME: str = "CineBook AI Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Service Security
    INTERNAL_API_KEY: str = "cinebook-internal-secret-key-change-in-production"
    JWT_SECRET: str = "cinebook-super-secret-key-minimum-256-bits-long-for-hs256-algorithm"
    JWT_ALGORITHM: str = "HS256"

    # PostgreSQL Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/cinebook"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30

    # Groq LLM Configuration
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_TEMPERATURE: float = 0.3
    GROQ_MAX_TOKENS: int = 1024
    GROQ_TIMEOUT_SECONDS: float = 15.0

    # Embedding Configuration
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIMENSION: int = 384
    EMBEDDING_BATCH_SIZE: int = 32

    # Java Backend Integration
    JAVA_BACKEND_URL: str = "http://localhost:8080"
    JAVA_BACKEND_TIMEOUT_SECONDS: float = 5.0

    # Logging & Observability
    LOG_LEVEL: str = "INFO"
    ENABLE_METRICS: bool = True

settings = Settings()
