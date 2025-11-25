"""Health check API route."""

from fastapi import APIRouter

from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.

    Returns system status including GPU availability and loaded models.
    """
    return HealthResponse(
        status="healthy",
        gpu_available=False,  # Dummy mode
        gpu_name=None,
        models_loaded=["vit-giant"],  # Pretend ViT-Giant is loaded
        version="1.0.0",
        mode="dummy",
    )
