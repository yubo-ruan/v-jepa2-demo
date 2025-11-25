"""Model comparison API for A/B testing different models."""

import asyncio
import logging
import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.websocket import ws_manager
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compare", tags=["compare"])


class ModelResult(BaseModel):
    """Result from a single model."""
    model_id: str
    model_name: str
    action: List[float]
    confidence: float
    energy: float
    inference_time_ms: float
    memory_used_mb: float


class ComparisonRequest(BaseModel):
    """Request to compare multiple models on same input."""
    current_image: str
    goal_image: str
    models: List[str] = Field(default=["vit-giant", "vit-huge", "vit-large"])
    samples: int = Field(default=200, ge=10, le=1000)
    iterations: int = Field(default=10, ge=1, le=50)


class ComparisonResult(BaseModel):
    """Full comparison result."""
    comparison_id: str
    status: str  # queued, running, completed, failed
    models_compared: int
    results: List[ModelResult] = []
    winner: Optional[str] = None  # model_id with best energy
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_time_seconds: float = 0


# Model characteristics for simulation
MODEL_SPECS = {
    "vit-giant": {
        "name": "ViT-Giant",
        "base_inference_ms": 120,
        "base_memory_mb": 8640,
        "accuracy_factor": 1.0,
    },
    "vit-huge": {
        "name": "ViT-Huge",
        "base_inference_ms": 80,
        "base_memory_mb": 5400,
        "accuracy_factor": 0.95,
    },
    "vit-large": {
        "name": "ViT-Large",
        "base_inference_ms": 50,
        "base_memory_mb": 2520,
        "accuracy_factor": 0.88,
    },
    "vit-giant-384": {
        "name": "ViT-Giant 384",
        "base_inference_ms": 150,
        "base_memory_mb": 9000,
        "accuracy_factor": 1.02,
    },
}

# In-memory storage
_comparisons: Dict[str, ComparisonResult] = {}


def _simulate_model_result(model_id: str, iterations: int) -> ModelResult:
    """Simulate planning result for a model."""
    spec = MODEL_SPECS.get(model_id, MODEL_SPECS["vit-large"])

    # Generate action (would be from actual planning)
    action = [
        round(random.gauss(2.5, 1.0), 2),
        round(random.gauss(-1.2, 0.8), 2),
        round(random.gauss(0.5, 0.3), 2),
    ]

    # Better models get better (lower) energy scores
    base_energy = random.uniform(1.0, 3.0)
    energy = base_energy / spec["accuracy_factor"]

    # Confidence correlates with accuracy
    confidence = 0.7 + spec["accuracy_factor"] * 0.2 + random.uniform(-0.05, 0.05)
    confidence = max(0.5, min(0.99, confidence))

    # Inference time varies with model size and iterations
    inference_time = spec["base_inference_ms"] * iterations * random.uniform(0.9, 1.1)

    # Memory usage
    memory = spec["base_memory_mb"] * random.uniform(0.95, 1.1)

    return ModelResult(
        model_id=model_id,
        model_name=spec["name"],
        action=action,
        confidence=round(confidence, 3),
        energy=round(energy, 3),
        inference_time_ms=round(inference_time, 1),
        memory_used_mb=round(memory, 0),
    )


@router.post("", response_model=ComparisonResult)
async def compare_models(request: ComparisonRequest):
    """
    Compare multiple models on the same input.

    Runs planning with each model and compares results.
    """
    # Validate models
    valid_models = [m for m in request.models if m in MODEL_SPECS]
    if not valid_models:
        raise HTTPException(status_code=400, detail="No valid models specified")

    comparison_id = str(uuid.uuid4())

    result = ComparisonResult(
        comparison_id=comparison_id,
        status="queued",
        models_compared=len(valid_models),
        created_at=datetime.now(),
    )
    _comparisons[comparison_id] = result

    # Start comparison in background
    asyncio.create_task(_run_comparison(comparison_id, valid_models, request))

    return result


async def _run_comparison(
    comparison_id: str,
    models: List[str],
    request: ComparisonRequest
):
    """Run comparison across models."""
    result = _comparisons.get(comparison_id)
    if not result:
        return

    result.status = "running"
    start_time = datetime.now()

    for i, model_id in enumerate(models):
        # Simulate processing time
        await asyncio.sleep(settings.dummy_iteration_delay * request.iterations * 0.3)

        model_result = _simulate_model_result(model_id, request.iterations)
        result.results.append(model_result)

        # Broadcast progress
        await ws_manager.send_message(comparison_id, {
            "type": "model_completed",
            "data": {
                "model_id": model_id,
                "progress": (i + 1) / len(models) * 100,
                "result": model_result.model_dump(),
            },
        })

    # Determine winner (lowest energy)
    if result.results:
        winner = min(result.results, key=lambda r: r.energy)
        result.winner = winner.model_id

    result.status = "completed"
    result.completed_at = datetime.now()
    result.total_time_seconds = (result.completed_at - start_time).total_seconds()

    logger.info(f"Comparison completed: {comparison_id}, winner: {result.winner}")

    await ws_manager.send_message(comparison_id, {
        "type": "completed",
        "data": result.model_dump(),
    })


@router.get("/{comparison_id}", response_model=ComparisonResult)
async def get_comparison(comparison_id: str):
    """Get comparison result."""
    if comparison_id not in _comparisons:
        raise HTTPException(status_code=404, detail="Comparison not found")
    return _comparisons[comparison_id]


@router.get("")
async def list_comparisons(limit: int = 20):
    """List recent comparisons."""
    comparisons = sorted(
        _comparisons.values(),
        key=lambda c: c.created_at,
        reverse=True
    )[:limit]

    return {
        "comparisons": [
            {
                "comparison_id": c.comparison_id,
                "status": c.status,
                "models_compared": c.models_compared,
                "winner": c.winner,
                "created_at": c.created_at,
            }
            for c in comparisons
        ],
        "total": len(_comparisons),
    }


@router.get("/leaderboard")
async def get_model_leaderboard():
    """Get aggregated model performance leaderboard."""
    # Aggregate results across all comparisons
    model_stats: Dict[str, Dict] = {}

    for comparison in _comparisons.values():
        if comparison.status != "completed":
            continue

        for result in comparison.results:
            if result.model_id not in model_stats:
                model_stats[result.model_id] = {
                    "model_id": result.model_id,
                    "model_name": result.model_name,
                    "total_runs": 0,
                    "wins": 0,
                    "total_energy": 0,
                    "total_confidence": 0,
                    "total_inference_time": 0,
                }

            stats = model_stats[result.model_id]
            stats["total_runs"] += 1
            stats["total_energy"] += result.energy
            stats["total_confidence"] += result.confidence
            stats["total_inference_time"] += result.inference_time_ms

            if comparison.winner == result.model_id:
                stats["wins"] += 1

    # Calculate averages and sort by win rate
    leaderboard = []
    for model_id, stats in model_stats.items():
        n = stats["total_runs"]
        leaderboard.append({
            "model_id": model_id,
            "model_name": stats["model_name"],
            "total_runs": n,
            "wins": stats["wins"],
            "win_rate": round(stats["wins"] / n * 100, 1) if n > 0 else 0,
            "avg_energy": round(stats["total_energy"] / n, 3) if n > 0 else 0,
            "avg_confidence": round(stats["total_confidence"] / n, 3) if n > 0 else 0,
            "avg_inference_ms": round(stats["total_inference_time"] / n, 1) if n > 0 else 0,
        })

    leaderboard.sort(key=lambda x: (-x["win_rate"], x["avg_energy"]))

    return {
        "leaderboard": leaderboard,
        "total_comparisons": len([c for c in _comparisons.values() if c.status == "completed"]),
    }
