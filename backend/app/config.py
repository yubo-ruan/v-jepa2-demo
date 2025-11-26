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

    # Upload settings
    max_upload_size_mb: int = 10

    # Batch processing
    batch_task_timeout_seconds: int = 300

    # Model defaults - optimized for 16GB Mac
    default_model: str = "vit-large"  # Best for 16GB unified memory
    default_samples: int = 400
    default_iterations: int = 10

    # Inference settings
    use_fp16: bool = True  # Use FP16 for memory efficiency
    max_batch_size: int = 1  # Conservative for 16GB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
