"""
V-JEPA2 Model Loading API Server

FastAPI backend that provides real-time model loading status via Server-Sent Events (SSE).
"""

import asyncio
import threading
import time
from enum import Enum
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel


class LoadingStatus(str, Enum):
    IDLE = "idle"
    INITIALIZING = "initializing"
    DOWNLOADING = "downloading"
    LOADING_WEIGHTS = "loading_weights"
    MOVING_TO_GPU = "moving_to_gpu"
    READY = "ready"
    ERROR = "error"


class ModelState(BaseModel):
    status: LoadingStatus = LoadingStatus.IDLE
    progress: int = 0
    message: str = "Model not loaded"
    model_name: Optional[str] = None
    device: Optional[str] = None
    error: Optional[str] = None


# Global state
model_state = ModelState()
model = None
processor = None
loading_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Cleanup on shutdown
    global model, processor
    model = None
    processor = None


app = FastAPI(title="V-JEPA2 Model API", lifespan=lifespan)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://69.30.85.167:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def update_state(
    status: LoadingStatus,
    progress: int,
    message: str,
    model_name: Optional[str] = None,
    device: Optional[str] = None,
    error: Optional[str] = None
):
    """Update the global model state."""
    global model_state
    model_state = ModelState(
        status=status,
        progress=progress,
        message=message,
        model_name=model_name or model_state.model_name,
        device=device or model_state.device,
        error=error
    )


def load_model_sync(model_name: str):
    """Synchronously load the V-JEPA2 model with status updates."""
    global model, processor

    try:
        update_state(LoadingStatus.INITIALIZING, 10, "Initializing model loader...", model_name)
        time.sleep(0.5)

        update_state(LoadingStatus.DOWNLOADING, 20, "Importing transformers library...")
        from transformers import AutoVideoProcessor, AutoModel
        time.sleep(0.3)

        update_state(LoadingStatus.DOWNLOADING, 40, f"Downloading model: {model_name}...")

        # Load processor
        update_state(LoadingStatus.DOWNLOADING, 50, "Loading video processor...")
        processor = AutoVideoProcessor.from_pretrained(model_name)

        # Load model
        update_state(LoadingStatus.LOADING_WEIGHTS, 60, "Loading model weights...")
        model = AutoModel.from_pretrained(model_name)

        update_state(LoadingStatus.LOADING_WEIGHTS, 80, "Model weights loaded successfully")

        # Move to GPU
        update_state(LoadingStatus.MOVING_TO_GPU, 90, "Moving model to GPU...")
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)

        update_state(
            LoadingStatus.READY,
            100,
            f"Model ready on {device.upper()}",
            model_name,
            device
        )

    except Exception as e:
        update_state(
            LoadingStatus.ERROR,
            0,
            f"Failed to load model: {str(e)}",
            error=str(e)
        )


@app.get("/api/status")
async def get_status():
    """Get current model loading status."""
    return model_state


@app.post("/api/load")
async def load_model(model_name: str = "facebook/vjepa2-vitg-fpc64-256"):
    """Start loading the V-JEPA2 model."""
    global model_state

    if model_state.status == LoadingStatus.READY:
        return {"message": "Model already loaded", "state": model_state}

    if model_state.status not in [LoadingStatus.IDLE, LoadingStatus.ERROR]:
        return {"message": "Model is already being loaded", "state": model_state}

    # Start loading in background thread
    thread = threading.Thread(target=load_model_sync, args=(model_name,))
    thread.start()

    return {"message": "Model loading started", "state": model_state}


@app.post("/api/unload")
async def unload_model():
    """Unload the model and free memory."""
    global model, processor, model_state

    if model is not None:
        import torch
        del model
        del processor
        model = None
        processor = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    model_state = ModelState()
    return {"message": "Model unloaded", "state": model_state}


@app.get("/api/stream")
async def stream_status():
    """Stream model loading status via Server-Sent Events."""
    async def event_generator():
        last_status = None
        while True:
            current = model_state.model_dump_json()
            if current != last_status:
                yield f"data: {current}\n\n"
                last_status = current

            # Stop streaming once model is ready or errored
            if model_state.status in [LoadingStatus.READY, LoadingStatus.ERROR]:
                yield f"data: {current}\n\n"
                break

            await asyncio.sleep(0.2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/models")
async def list_models():
    """List available V-JEPA2 models."""
    return {
        "models": [
            # Standard Models
            {
                "id": "facebook/vjepa2-vitl-fpc64-256",
                "name": "V-JEPA2 ViT-Large",
                "type": "standard",
                "params": "300M",
                "resolution": 256,
                "description": "Lightweight model for faster inference"
            },
            {
                "id": "facebook/vjepa2-vith-fpc64-256",
                "name": "V-JEPA2 ViT-Huge",
                "type": "standard",
                "params": "600M",
                "resolution": 256,
                "description": "Balanced accuracy and speed"
            },
            {
                "id": "facebook/vjepa2-vitg-fpc64-256",
                "name": "V-JEPA2 ViT-Giant",
                "type": "standard",
                "params": "1B",
                "resolution": 256,
                "description": "Best accuracy, slower inference"
            },
            {
                "id": "facebook/vjepa2-vitg-fpc64-384",
                "name": "V-JEPA2 ViT-Giant 384",
                "type": "standard",
                "params": "1B",
                "resolution": 384,
                "description": "High-resolution variant"
            },
            # Action-Conditioned Models
            {
                "id": "vjepa2_ac_vit_large",
                "name": "V-JEPA2 AC ViT-Large",
                "type": "action_conditioned",
                "params": "300M",
                "resolution": 256,
                "description": "Action-conditioned prediction (PyTorch Hub)"
            },
            {
                "id": "vjepa2_ac_vit_huge",
                "name": "V-JEPA2 AC ViT-Huge",
                "type": "action_conditioned",
                "params": "600M",
                "resolution": 256,
                "description": "Medium AC model (PyTorch Hub)"
            },
            {
                "id": "vjepa2_ac_vit_giant",
                "name": "V-JEPA2 AC ViT-Giant ✓",
                "type": "action_conditioned",
                "params": "1B",
                "resolution": 256,
                "description": "Confirmed available (PyTorch Hub)"
            },
            {
                "id": "vjepa2_ac_vit_giant_384",
                "name": "V-JEPA2 AC ViT-Giant 384",
                "type": "action_conditioned",
                "params": "1B",
                "resolution": 384,
                "description": "High-res AC model (PyTorch Hub)"
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
