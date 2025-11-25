"""Experiment history API routes (in-memory dummy implementation)."""

import uuid
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import (
    Experiment,
    ExperimentCreate,
    ExperimentUpdate,
    ExperimentsResponse,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])

# In-memory storage for dummy implementation
_experiments: Dict[str, Experiment] = {}

# Pre-populate with sample data
SAMPLE_EXPERIMENTS = [
    Experiment(
        id="exp_001",
        created_at=datetime(2024, 11, 25, 14, 34),
        title="Robot reach task",
        confidence=0.82,
        energy=1.23,
        time_seconds=3.4,
        model="ViT-Giant",
        action=[3.2, -1.5, 0.8],
        samples=400,
        iterations=10,
        favorite=True,
    ),
    Experiment(
        id="exp_002",
        created_at=datetime(2024, 11, 25, 13, 15),
        title="Pick and place demo",
        confidence=0.75,
        energy=1.45,
        time_seconds=2.8,
        model="ViT-Huge",
        action=[2.8, -1.2, 1.0],
        samples=200,
        iterations=8,
        favorite=False,
    ),
    Experiment(
        id="exp_003",
        created_at=datetime(2024, 11, 24, 16, 22),
        title="Grasp optimization",
        confidence=0.90,
        energy=0.98,
        time_seconds=4.1,
        model="ViT-Giant",
        action=[-1.5, 2.3, 0.5],
        samples=600,
        iterations=12,
        favorite=True,
    ),
    Experiment(
        id="exp_004",
        created_at=datetime(2024, 11, 24, 11, 8),
        title="Assembly task test",
        confidence=0.45,
        energy=2.34,
        time_seconds=5.2,
        model="ViT-Large",
        action=[0.8, -0.5, 2.1],
        samples=100,
        iterations=5,
        favorite=False,
    ),
]

# Initialize with sample data
for exp in SAMPLE_EXPERIMENTS:
    _experiments[exp.id] = exp


@router.get("", response_model=ExperimentsResponse)
async def list_experiments(
    filter: Optional[str] = Query(None, description="Filter: all, high, medium, low, favorites"),
    sort: Optional[str] = Query("recent", description="Sort: recent, confidence-high, confidence-low"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List experiments with filtering and sorting.

    Filters:
    - all: No filter
    - high: confidence >= 0.8
    - medium: 0.5 <= confidence < 0.8
    - low: confidence < 0.5
    - favorites: favorite == True

    Sort options:
    - recent: Most recent first (default)
    - confidence-high: Highest confidence first
    - confidence-low: Lowest confidence first
    """
    experiments = list(_experiments.values())

    # Apply filter
    if filter == "high":
        experiments = [e for e in experiments if e.confidence >= 0.8]
    elif filter == "medium":
        experiments = [e for e in experiments if 0.5 <= e.confidence < 0.8]
    elif filter == "low":
        experiments = [e for e in experiments if e.confidence < 0.5]
    elif filter == "favorites":
        experiments = [e for e in experiments if e.favorite]

    # Apply sort
    if sort == "recent":
        experiments.sort(key=lambda e: e.created_at, reverse=True)
    elif sort == "confidence-high":
        experiments.sort(key=lambda e: e.confidence, reverse=True)
    elif sort == "confidence-low":
        experiments.sort(key=lambda e: e.confidence)

    total = len(experiments)

    # Apply pagination
    experiments = experiments[offset : offset + limit]

    return ExperimentsResponse(experiments=experiments, total=total)


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str):
    """Get a single experiment by ID."""
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return _experiments[experiment_id]


@router.post("", response_model=Experiment)
async def create_experiment(data: ExperimentCreate):
    """Create a new experiment record."""
    experiment_id = f"exp_{uuid.uuid4().hex[:8]}"
    experiment = Experiment(
        id=experiment_id,
        created_at=datetime.now(),
        title=data.title,
        confidence=data.confidence,
        energy=data.energy,
        time_seconds=data.time_seconds,
        model=data.model,
        action=data.action,
        samples=data.samples,
        iterations=data.iterations,
        favorite=False,
        current_image_url=data.current_image_url,
        goal_image_url=data.goal_image_url,
    )
    _experiments[experiment_id] = experiment
    return experiment


@router.patch("/{experiment_id}", response_model=Experiment)
async def update_experiment(experiment_id: str, data: ExperimentUpdate):
    """Update an experiment (title, favorite status)."""
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")

    experiment = _experiments[experiment_id]

    if data.title is not None:
        experiment = experiment.model_copy(update={"title": data.title})
    if data.favorite is not None:
        experiment = experiment.model_copy(update={"favorite": data.favorite})

    _experiments[experiment_id] = experiment
    return experiment


@router.delete("/{experiment_id}")
async def delete_experiment(experiment_id: str):
    """Delete an experiment."""
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")

    del _experiments[experiment_id]
    return {"status": "deleted", "id": experiment_id}
