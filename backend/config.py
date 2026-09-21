from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    qdrant_url: str
    qdrant_api_key: str
    frontend_url: str = "http://localhost:5173"
    cognito_issuer: str
    cognito_client_id: str
    cognito_region: str = "ap-south-1"
    s3_bucket_name: str
    aws_region: str = "ap-south-1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()