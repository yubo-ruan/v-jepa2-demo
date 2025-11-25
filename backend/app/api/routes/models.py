"""Model management API routes with download simulation."""

import asyncio
from fastapi import APIRouter, HTTPException
from typing import List, Dict

from app.models.schemas import ModelInfo, ModelsResponse
from app.services.dummy_download import dummy_download
from app.api.websocket import ws_manager

router = APIRouter(prefix="/models", tags=["models"])

# Model registry with details
MODEL_REGISTRY: Dict[str, dict] = {
    "vit-giant": {
        "name": "ViT-Giant",
        "params": "1.2B",
        "size_gb": 7.2,
        "description": "Best quality, recommended for production",
        "input_resolution": 224,
        "embedding_dim": 1408,
        "layers": 40,
        "heads": 16,
    },
    "vit-huge": {
        "name": "ViT-Huge",
        "params": "600M",
        "size_gb": 4.5,
        "description": "Balanced speed and quality",
        "input_resolution": 224,
        "embedding_dim": 1280,
        "layers": 32,
        "heads": 16,
    },
    "vit-large": {
        "name": "ViT-Large",
        "params": "300M",
        "size_gb": 2.1,
        "description": "Fastest inference, good for prototyping",
        "input_resolution": 224,
        "embedding_dim": 1024,
        "layers": 24,
        "heads": 16,
    },
    "vit-giant-384": {
        "name": "ViT-Giant 384",
        "params": "1.2B",
        "size_gb": 7.5,
        "description": "Highest resolution input (384x384)",
        "input_resolution": 384,
        "embedding_dim": 1408,
        "layers": 40,
        "heads": 16,
    },
}

# Track download tasks
_download_tasks: Dict[str, str] = {}  # model_id -> task_id


def _get_model_info(model_id: str) -> ModelInfo:
    """Build ModelInfo from registry."""
    reg = MODEL_REGISTRY.get(model_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Model not found")

    cached = dummy_download.is_cached(model_id)
    task_id = _download_tasks.get(model_id)
    progress = 100 if cached else 0

    # Check if download in progress
    if task_id:
        task = dummy_download.get_task(task_id)
        if task and task.status == "downloading":
            progress = int((task.downloaded_mb / task.total_size_mb) * 100)

    return ModelInfo(
        id=model_id,
        name=reg["name"],
        params=reg["params"],
        size_gb=reg["size_gb"],
        cached=cached,
        download_progress=progress,
    )


@router.get("", response_model=ModelsResponse)
async def list_models():
    """List all available models and their cache status."""
    models = [_get_model_info(mid) for mid in MODEL_REGISTRY.keys()]
    return ModelsResponse(models=models)


@router.get("/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str):
    """Get information about a specific model."""
    return _get_model_info(model_id)


@router.get("/{model_id}/details")
async def get_model_details(model_id: str):
    """Get detailed model architecture info."""
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    reg = MODEL_REGISTRY[model_id]
    info = _get_model_info(model_id)

    return {
        **info.model_dump(),
        "description": reg["description"],
        "architecture": {
            "input_resolution": reg["input_resolution"],
            "embedding_dim": reg["embedding_dim"],
            "layers": reg["layers"],
            "attention_heads": reg["heads"],
            "patch_size": 14,
            "num_patches": (reg["input_resolution"] // 14) ** 2,
        },
        "performance": {
            "inference_time_ms": 50 if model_id == "vit-large" else (80 if model_id == "vit-huge" else 120),
            "memory_usage_mb": int(reg["size_gb"] * 1000 * 1.2),  # ~20% overhead
            "recommended_batch_size": 16 if model_id == "vit-large" else (8 if model_id == "vit-huge" else 4),
        },
    }


@router.post("/{model_id}/download")
async def download_model(model_id: str):
    """
    Start downloading a model.

    Returns task_id for WebSocket progress tracking at /ws/download/{task_id}
    """
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    if dummy_download.is_cached(model_id):
        return {"status": "already_cached", "model_id": model_id}

    # Check if already downloading
    if model_id in _download_tasks:
        task = dummy_download.get_task(_download_tasks[model_id])
        if task and task.status == "downloading":
            return {
                "status": "already_downloading",
                "model_id": model_id,
                "task_id": task.id,
                "websocket_url": f"/ws/download/{task.id}",
            }

    reg = MODEL_REGISTRY[model_id]
    task_id = dummy_download.create_task(model_id, reg["name"])
    _download_tasks[model_id] = task_id

    # Start download in background
    asyncio.create_task(_run_download_with_ws(task_id))

    return {
        "status": "download_started",
        "model_id": model_id,
        "task_id": task_id,
        "websocket_url": f"/ws/download/{task_id}",
    }


async def _run_download_with_ws(task_id: str):
    """Run download and broadcast progress via WebSocket."""

    async def progress_callback(progress: dict):
        await ws_manager.send_message(task_id, {
            "type": "progress",
            "data": progress,
        })

    try:
        await dummy_download.run_download(task_id, progress_callback)
        await ws_manager.send_message(task_id, {
            "type": "completed",
            "data": {"message": "Download complete"},
        })
    except Exception as e:
        await ws_manager.send_message(task_id, {
            "type": "error",
            "data": {"message": str(e)},
        })


@router.get("/{model_id}/download/status")
async def get_download_status(model_id: str):
    """Get current download status for a model."""
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    if dummy_download.is_cached(model_id):
        return {
            "model_id": model_id,
            "status": "cached",
            "percent": 100,
        }

    task_id = _download_tasks.get(model_id)
    if not task_id:
        return {
            "model_id": model_id,
            "status": "not_started",
            "percent": 0,
        }

    task = dummy_download.get_task(task_id)
    if not task:
        return {
            "model_id": model_id,
            "status": "not_started",
            "percent": 0,
        }

    return {
        "model_id": model_id,
        "status": task.status,
        "percent": round((task.downloaded_mb / task.total_size_mb) * 100, 1),
        "downloaded_mb": round(task.downloaded_mb, 1),
        "total_mb": task.total_size_mb,
        "speed_mbps": task.speed_mbps,
        "eta_seconds": task.eta_seconds,
    }


@router.post("/{model_id}/download/cancel")
async def cancel_download(model_id: str):
    """Cancel an ongoing download."""
    task_id = _download_tasks.get(model_id)
    if not task_id:
        raise HTTPException(status_code=400, detail="No download in progress")

    success = dummy_download.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not cancel download")

    return {"status": "cancelled", "model_id": model_id}


@router.delete("/{model_id}/cache")
async def delete_model_cache(model_id: str):
    """Delete cached model weights."""
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    if not dummy_download.is_cached(model_id):
        return {"status": "not_cached", "model_id": model_id}

    # Simulate deletion
    dummy_download.cached_models[model_id] = False
    if model_id in _download_tasks:
        del _download_tasks[model_id]

    return {
        "status": "deleted",
        "model_id": model_id,
        "freed_gb": MODEL_REGISTRY[model_id]["size_gb"],
    }


@router.get("/cache/summary")
async def get_cache_summary():
    """Get summary of cached models and disk usage."""
    cached = []
    total_cached_gb = 0

    for model_id in MODEL_REGISTRY:
        if dummy_download.is_cached(model_id):
            reg = MODEL_REGISTRY[model_id]
            cached.append({
                "id": model_id,
                "name": reg["name"],
                "size_gb": reg["size_gb"],
            })
            total_cached_gb += reg["size_gb"]

    total_available_gb = sum(m["size_gb"] for m in MODEL_REGISTRY.values())

    return {
        "cached_models": cached,
        "cached_count": len(cached),
        "total_count": len(MODEL_REGISTRY),
        "cached_size_gb": round(total_cached_gb, 2),
        "total_available_gb": round(total_available_gb, 2),
    }
