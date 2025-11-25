"""Pydantic schemas for API request/response models."""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# =============================================================================
# Planning Schemas
# =============================================================================

class PlanningRequest(BaseModel):
    """Request to start a planning task."""
    current_image: str  # base64 or upload_id
    goal_image: str  # base64 or upload_id
    model: str = "vit-giant"
    samples: int = Field(default=400, ge=50, le=1000)
    iterations: int = Field(default=10, ge=3, le=20)
    elite_fraction: float = Field(default=0.1, ge=0.05, le=0.3)


class PlanningProgress(BaseModel):
    """Progress update during planning."""
    iteration: int
    total_iterations: int
    best_energy: float
    samples_evaluated: int
    elapsed_seconds: float
    eta_seconds: float


class ActionResult(BaseModel):
    """Result of planning - the optimal action."""
    action: List[float]  # [x, y, z] or 7D
    confidence: float = Field(ge=0, le=1)
    energy: float
    energy_history: List[float] = []


class PlanningTaskResponse(BaseModel):
    """Response when creating a planning task."""
    task_id: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    websocket_url: str


class PlanningResultResponse(BaseModel):
    """Full planning task status and result."""
    task_id: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    progress: Optional[PlanningProgress] = None
    result: Optional[ActionResult] = None
    error: Optional[str] = None


# =============================================================================
# Model Management Schemas
# =============================================================================

class ModelInfo(BaseModel):
    """Information about a model."""
    id: str
    name: str
    params: str
    size_gb: float
    cached: bool
    download_progress: int = Field(ge=0, le=100)


class ModelsResponse(BaseModel):
    """Response listing all models."""
    models: List[ModelInfo]


# =============================================================================
# Experiment History Schemas
# =============================================================================

class ExperimentCreate(BaseModel):
    """Request to create an experiment record."""
    title: str
    model: str
    action: List[float]
    confidence: float
    energy: float
    time_seconds: float
    samples: int
    iterations: int
    current_image_url: Optional[str] = None
    goal_image_url: Optional[str] = None


class ExperimentUpdate(BaseModel):
    """Request to update an experiment."""
    title: Optional[str] = None
    favorite: Optional[bool] = None


class Experiment(BaseModel):
    """Full experiment record."""
    id: str
    created_at: datetime
    title: str
    confidence: float
    energy: float
    time_seconds: float
    model: str
    action: List[float]
    samples: int
    iterations: int
    favorite: bool = False
    current_image_url: Optional[str] = None
    goal_image_url: Optional[str] = None


class ExperimentsResponse(BaseModel):
    """Response listing experiments."""
    experiments: List[Experiment]
    total: int


# =============================================================================
# Upload Schemas
# =============================================================================

class UploadResponse(BaseModel):
    """Response after uploading an image."""
    upload_id: str
    url: str
    width: int
    height: int


# =============================================================================
# Health Check Schemas
# =============================================================================

class HealthResponse(BaseModel):
    """Health check response."""
    status: Literal["healthy", "degraded", "unhealthy"]
    gpu_available: bool
    gpu_name: Optional[str] = None
    models_loaded: List[str] = []
    version: str = "1.0.0"
    mode: str = "dummy"  # "dummy" or "production"


# =============================================================================
# WebSocket Message Schemas
# =============================================================================

class WSMessage(BaseModel):
    """WebSocket message wrapper."""
    type: Literal["progress", "completed", "error", "cancelled"]
    data: dict
