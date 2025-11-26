"""Health check API route."""

import torch
from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.services.vjepa2 import get_model_loader

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.

    Returns system status including GPU availability and loaded models.
    """
    # Get real device information
    if torch.cuda.is_available():
        gpu_available = True
        gpu_name = torch.cuda.get_device_name(0)
    elif torch.backends.mps.is_available():
        gpu_available = True
        gpu_name = "Apple Silicon (MPS)"
    else:
        gpu_available = False
        gpu_name = None

    # Get loaded models from model loader
    loader = get_model_loader()
    models_loaded = [loader.current_model] if loader.is_loaded() else []

    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        gpu_name=gpu_name,
        models_loaded=models_loaded,
        version="1.0.0",
        mode="real",
    )
