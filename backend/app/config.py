"""Application configuration."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Storage
    upload_dir: str = "./data/uploads"
    model_cache_dir: str = "./data/models"

    # Dummy mode settings
    dummy_mode: bool = True
    dummy_iteration_delay: float = 0.5  # seconds between iterations

    # Model defaults
    default_model: str = "vit-giant"
    default_samples: int = 400
    default_iterations: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
