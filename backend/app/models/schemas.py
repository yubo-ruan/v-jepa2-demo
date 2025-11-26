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
    status: Literal["loading_model", "encoding", "running", "completed"] = "running"
    model_loading: Optional[str] = None  # Model name when status is "loading_model"
    download_progress: Optional[float] = None  # 0.0-1.0 for model download progress
    download_total_gb: Optional[float] = None  # Total download size in GB
    download_downloaded_gb: Optional[float] = None  # Downloaded so far in GB
    download_speed_mbps: Optional[float] = None  # Current download speed in MB/s
    download_eta_seconds: Optional[float] = None  # Estimated time remaining for download
    iteration: int = 0
    total_iterations: int = 0
    best_energy: float = 0.0
    energy_history: List[float] = []  # Energy values per iteration for live chart updates
    samples_evaluated: int = 0
    elapsed_seconds: float = 0.0
    eta_seconds: float = 0.0


class ActionResult(BaseModel):
    """Result of planning - the optimal action."""
    action: List[float]  # [x, y, z] or 7D for AC models
    confidence: float = Field(ge=0, le=1)
    energy: float
    energy_history: List[float] = []
    is_ac_model: bool = False  # True if action-conditioned predictor was used

    # Validation threshold check
    energy_threshold: float = 3.0  # Default threshold
    passes_threshold: bool = False  # True if energy < threshold
    normalized_distance: float = 0.0  # Energy normalized to 0-1 scale


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


class EvaluateActionsRequest(BaseModel):
    """Request to evaluate multiple actions against goal embeddings."""
    current_image: str  # base64 or upload_id
    goal_image: str  # base64 or upload_id
    actions: List[List[float]]  # List of actions to evaluate [[x,y,z], ...]
    model: str = "vit-giant"


class ActionEnergy(BaseModel):
    """Energy value for a single action."""
    action: List[float]
    energy: float


class EvaluateActionsResponse(BaseModel):
    """Response with energy values for all evaluated actions."""
    energies: List[ActionEnergy]
    min_energy: float
    max_energy: float
    is_ac_model: bool = False


# =============================================================================
# Model Management Schemas
# =============================================================================

ModelStatus = Literal["loaded", "loading", "cached", "downloading", "not_downloaded"]


class ModelInfo(BaseModel):
    """Information about a model."""
    id: str
    name: str
    params: str
    size_gb: float
    cached: bool
    download_progress: int = Field(ge=0, le=100)
    is_ac: bool = False  # True if action-conditioned model
    action_dim: Optional[int] = None  # 7 for AC models (DROID format)


class ModelStatusItem(BaseModel):
    """Model with full status information for management UI."""
    id: str
    name: str
    params: str
    size_gb: float
    status: ModelStatus
    download_percent: int = Field(ge=0, le=100, default=0)
    is_ac: bool = False


class ModelsStatusResponse(BaseModel):
    """Response for model management status endpoint."""
    models: List[ModelStatusItem]
    loaded_model: Optional[str] = None


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
    type: Literal["progress", "loading_model", "completed", "error", "cancelled"]
    data: dict
