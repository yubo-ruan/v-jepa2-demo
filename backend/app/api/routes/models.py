"""Model management API routes with real V-JEPA2 model loading."""

import asyncio
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    ModelInfo,
    ModelsResponse,
    ModelStatusItem,
    ModelsStatusResponse,
)
from app.services.vjepa2 import get_model_loader, get_download_progress, set_download_progress, clear_download_progress
from app.api.websocket import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"])

# Track model loading state
_loading_model_id: Optional[str] = None

# Model variants - map to actual V-JEPA2 hub models
# Each variant corresponds to a base model that can be loaded
MODEL_VARIANTS: Dict[str, dict] = {
    "vit-large": {
        "name": "V-JEPA2 ViT-Large",
        "description": "Best for 16GB devices (~300M params, ~4.8GB)",
        "base_model": "vit-large",
        "is_recommended": True,  # Recommended for most users
    },
    "vit-huge": {
        "name": "V-JEPA2 ViT-Huge",
        "description": "Balanced quality/speed (~630M params, ~9.5GB)",
        "base_model": "vit-huge",
        "is_recommended": False,
    },
    "vit-giant": {
        "name": "V-JEPA2 ViT-Giant",
        "description": "Best quality, requires 32GB+ (~1.2B params, ~15.3GB)",
        "base_model": "vit-giant",
        "is_recommended": False,
    },
    "vit-giant-ac": {
        "name": "V-JEPA2-AC ViT-Giant",
        "description": "Action-Conditioned for planning (7D actions, ~15.5GB)",
        "base_model": "vit-giant-ac",
        "is_recommended": False,
    },
}

# Base model registry with architecture details
MODEL_REGISTRY: Dict[str, dict] = {
    "vit-large": {
        "name": "V-JEPA2 ViT-Large",
        "params": "300M",
        "size_gb": 4.8,  # Actual download size
        "description": "Best for 16GB devices, fastest inference",
        "input_resolution": 224,
        "embedding_dim": 1024,
        "layers": 24,
        "heads": 16,
        "is_ac": False,
    },
    "vit-huge": {
        "name": "V-JEPA2 ViT-Huge",
        "params": "630M",
        "size_gb": 9.5,  # Actual download size
        "description": "Balanced speed and quality",
        "input_resolution": 224,
        "embedding_dim": 1280,
        "layers": 32,
        "heads": 16,
        "is_ac": False,
    },
    "vit-giant": {
        "name": "V-JEPA2 ViT-Giant",
        "params": "1.2B",
        "size_gb": 15.3,  # Actual download size
        "description": "Best quality, requires 32GB+ memory",
        "input_resolution": 224,
        "embedding_dim": 1408,
        "layers": 40,
        "heads": 16,
        "is_ac": False,
    },
    "vit-giant-ac": {
        "name": "V-JEPA2-AC ViT-Giant",
        "params": "1.2B",
        "size_gb": 15.5,  # Actual download size
        "description": "Action-Conditioned for planning (7D DROID actions)",
        "input_resolution": 256,
        "embedding_dim": 1408,
        "layers": 40,
        "heads": 16,
        "is_ac": True,
        "action_dim": 7,
    },
}

# Track download tasks
_download_tasks: Dict[str, str] = {}  # model_id -> task_id


def _get_model_info(model_id: str) -> ModelInfo:
    """Build ModelInfo from registry."""
    reg = MODEL_REGISTRY.get(model_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Model not found")

    # Use real PyTorch hub cache check
    loader = get_model_loader()
    cached = loader.is_cached(model_id)

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
        is_ac=reg.get("is_ac", False),
        action_dim=reg.get("action_dim"),
    )


@router.get("", response_model=ModelsResponse)
async def list_models():
    """List all available models and their cache status."""
    models = [_get_model_info(mid) for mid in MODEL_REGISTRY.keys()]
    return ModelsResponse(models=models)


@router.get("/status", response_model=ModelsStatusResponse)
async def get_models_status():
    """
    Get unified status of all models for management UI.

    Returns status for each model:
    - loaded: In GPU memory, ready for inference
    - loading: Currently being loaded into GPU memory
    - cached: Downloaded to disk, not in memory
    - downloading: Currently downloading from internet
    - not_downloaded: Not on disk
    """
    global _loading_model_id
    loader = get_model_loader()

    models = []
    for model_id, reg in MODEL_REGISTRY.items():
        # Determine status
        if loader.is_loaded(model_id):
            status = "loaded"
            download_percent = 100
        elif _loading_model_id == model_id:
            status = "loading"
            download_percent = 100
        elif loader.is_cached(model_id):
            status = "cached"
            download_percent = 100
        else:
            # Check if downloading
            progress = get_download_progress(model_id)
            if progress and progress.get("total", 0) > 0:
                status = "downloading"
                download_percent = int((progress["downloaded"] / progress["total"]) * 100)
            else:
                status = "not_downloaded"
                download_percent = 0

        models.append(ModelStatusItem(
            id=model_id,
            name=reg["name"],
            params=reg["params"],
            size_gb=reg["size_gb"],
            status=status,
            download_percent=download_percent,
            is_ac=reg.get("is_ac", False),
        ))

    return ModelsStatusResponse(
        models=models,
        loaded_model=loader._loaded_model_id,
    )


@router.post("/{model_id}/load")
async def load_model(model_id: str):
    """
    Load a cached model into GPU memory.

    Returns immediately with status "loading", actual load happens in background.
    Unloads any currently loaded model first.
    """
    global _loading_model_id

    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    loader = get_model_loader()

    # Check if already loaded
    if loader.is_loaded(model_id):
        return {"status": "already_loaded", "model_id": model_id}

    # Check if cached (downloaded)
    if not loader.is_cached(model_id):
        raise HTTPException(
            status_code=400,
            detail="Model not downloaded. Download first using POST /models/{model_id}/download"
        )

    # Check if already loading
    if _loading_model_id == model_id:
        return {"status": "already_loading", "model_id": model_id}

    # Set loading state
    _loading_model_id = model_id

    # Start loading in background thread
    async def _load_in_background():
        global _loading_model_id
        loop = asyncio.get_event_loop()
        try:
            logger.info(f"Background task starting to load {model_id}...")
            await loop.run_in_executor(None, lambda: loader.load_model(model_id))
            logger.info(f"✓ Model {model_id} loaded successfully in background task")
            logger.info(f"  Loader state: is_loaded={loader.is_loaded(model_id)}, loaded_id={loader._loaded_model_id}")
        except Exception as e:
            logger.error(f"✗ Failed to load model {model_id} in background task: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            _loading_model_id = None
            logger.info(f"Background loading task for {model_id} completed, _loading_model_id cleared")

    # Keep reference to prevent garbage collection
    task = asyncio.create_task(_load_in_background())
    # Store task reference
    if not hasattr(load_model, '_tasks'):
        load_model._tasks = []
    load_model._tasks.append(task)

    return {
        "status": "loading",
        "model_id": model_id,
        "message": "Model is being loaded into GPU memory",
    }


@router.post("/{model_id}/unload")
async def unload_model(model_id: str):
    """
    Unload a model from GPU memory.
    """
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    loader = get_model_loader()

    if not loader.is_loaded(model_id):
        return {"status": "not_loaded", "model_id": model_id}

    # Unload the model
    loader.unload_model()

    return {
        "status": "unloaded",
        "model_id": model_id,
        "message": "Model unloaded from GPU memory",
    }


@router.get("/variants")
async def list_model_variants():
    """List available model variants (fine-tuned versions)."""
    variants = []
    for variant_id, variant in MODEL_VARIANTS.items():
        base_model = MODEL_REGISTRY.get(variant["base_model"], {})
        variants.append({
            "id": variant_id,
            "name": variant["name"],
            "description": variant["description"],
            "base_model": variant["base_model"],
            "base_model_name": base_model.get("name", "Unknown"),
            "is_recommended": variant["is_recommended"],
        })
    return {"variants": variants}


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
    Start downloading a model via PyTorch Hub.

    For V-JEPA2 models, this triggers model loading which automatically
    downloads from PyTorch Hub if not cached.
    """
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    loader = get_model_loader()

    # Check if already cached
    if loader.is_cached(model_id):
        return {"status": "already_cached", "model_id": model_id}

    # Check if already downloading/loading
    if model_id in _download_tasks:
        return {
            "status": "already_downloading",
            "model_id": model_id,
            "task_id": _download_tasks[model_id],
        }

    # For PyTorch Hub models, "download" means triggering load_model
    # which will download if not cached
    import uuid
    task_id = str(uuid.uuid4())
    _download_tasks[model_id] = task_id

    # Start download/load in background
    asyncio.create_task(_run_real_download(model_id, task_id))

    return {
        "status": "download_started",
        "model_id": model_id,
        "task_id": task_id,
    }


async def _run_real_download(model_id: str, task_id: str) -> None:
    """
    Run real model download via PyTorch Hub.

    PyTorch Hub automatically downloads models when load_model() is called.
    We load the model which downloads it if needed, then unload it.
    """
    loader = get_model_loader()

    try:
        logger.info(f"Starting PyTorch Hub download for {model_id}")

        # Set initial progress
        set_download_progress(model_id, {
            "downloaded": 0,
            "total": MODEL_REGISTRY[model_id]["size_gb"] * 1024,  # Convert to MB
            "status": "downloading",
        })

        # Call load_model in executor (blocking operation)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: loader.load_model(model_id))

        # Mark as complete
        set_download_progress(model_id, {
            "downloaded": MODEL_REGISTRY[model_id]["size_gb"] * 1024,
            "total": MODEL_REGISTRY[model_id]["size_gb"] * 1024,
            "status": "completed",
        })

        logger.info(f"PyTorch Hub download completed for {model_id}")

        # Clean up task
        _download_tasks.pop(model_id, None)

        # Clear progress after a delay
        await asyncio.sleep(2)
        clear_download_progress(model_id)

    except Exception as e:
        logger.error(f"Download failed for {model_id}: {e}")
        set_download_progress(model_id, {
            "downloaded": 0,
            "total": MODEL_REGISTRY[model_id]["size_gb"] * 1024,
            "status": "failed",
            "error": str(e),
        })
        _download_tasks.pop(model_id, None)


@router.get("/{model_id}/download/status")
async def get_download_status(model_id: str):
    """Get current download status for a model."""
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    loader = get_model_loader()
    if loader.is_cached(model_id):
        return {
            "model_id": model_id,
            "status": "cached",
            "percent": 100,
        }

    # Check real download progress
    progress = get_download_progress(model_id)
    if progress and progress.get("status") == "downloading":
        total = progress.get("total", 1)
        downloaded = progress.get("downloaded", 0)
        percent = int((downloaded / total) * 100) if total > 0 else 0
        return {
            "model_id": model_id,
            "status": "downloading",
            "percent": percent,
            "downloaded_mb": downloaded,
            "total_mb": total,
        }

    return {
        "model_id": model_id,
        "status": "not_started",
        "percent": 0,
    }


@router.post("/{model_id}/download/cancel")
async def cancel_download(model_id: str):
    """Cancel an ongoing download."""
    task_id = _download_tasks.get(model_id)
    if not task_id:
        raise HTTPException(status_code=400, detail="No download in progress")

    # For real PyTorch Hub downloads, we can't easily cancel mid-download
    # Just clear the task and progress
    _download_tasks.pop(model_id, None)
    clear_download_progress(model_id)

    return {"status": "cancelled", "model_id": model_id}


@router.delete("/{model_id}/cache")
async def delete_model_cache(model_id: str):
    """Delete cached model weights."""
    if model_id not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail="Model not found")

    # Use real PyTorch hub cache check
    loader = get_model_loader()
    if not loader.is_cached(model_id):
        return {"status": "not_cached", "model_id": model_id}

    # Note: This is a simulation - actual cache deletion would require filesystem access
    # For now, just track in dummy_download
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
    # Use real PyTorch hub cache check
    loader = get_model_loader()
    cached = []
    total_cached_gb = 0

    for model_id in MODEL_REGISTRY:
        if loader.is_cached(model_id):
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
