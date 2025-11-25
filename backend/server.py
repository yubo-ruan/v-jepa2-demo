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
    """Synchronously load the V-JEPA2 Giant model with status updates."""
    global model, processor

    try:
        update_state(LoadingStatus.INITIALIZING, 5, "Initializing...", model_name)

        import torch
        from torch.hub import download_url_to_file
        import urllib.request

        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Hook into download progress
        original_download = download_url_to_file

        def download_with_progress(url, dst, hash_prefix=None, progress=True):
            def report(count, block_size, total_size):
                if total_size > 0:
                    downloaded = count * block_size
                    percent = min(int(downloaded * 100 / total_size), 100)
                    downloaded_gb = downloaded / (1024**3)
                    total_gb = total_size / (1024**3)
                    msg = f"Downloading: {downloaded_gb:.2f}GB / {total_gb:.2f}GB"
                    update_state(LoadingStatus.DOWNLOADING, 10 + int(percent * 0.5), msg, model_name)

            urllib.request.urlretrieve(url, dst, reporthook=report)

        # Monkey patch for progress tracking
        torch.hub.download_url_to_file = download_with_progress

        update_state(LoadingStatus.DOWNLOADING, 10, "Loading preprocessor...")
        processor = torch.hub.load('facebookresearch/vjepa2', 'vjepa2_preprocessor')

        update_state(LoadingStatus.DOWNLOADING, 15, "Starting model download...")
        encoder, predictor = torch.hub.load('facebookresearch/vjepa2', model_name)

        # Restore original
        torch.hub.download_url_to_file = original_download

        update_state(LoadingStatus.LOADING_WEIGHTS, 70, "Loading weights to memory...")
        update_state(LoadingStatus.MOVING_TO_GPU, 85, f"Moving to {device.upper()}...")
        encoder = encoder.to(device)
        predictor = predictor.to(device)
        model = (encoder, predictor)

        update_state(LoadingStatus.READY, 100, f"Ready on {device.upper()}", model_name, device)

    except Exception as e:
        update_state(LoadingStatus.ERROR, 0, f"Error: {str(e)}", error=str(e))


@app.get("/api/status")
async def get_status():
    """Get current model loading status."""
    return model_state


@app.post("/api/load")
async def load_model():
    """Start loading the V-JEPA2 Giant model."""
    global model_state

    # Fixed model - always load vjepa2_ac_vit_giant
    model_name = "vjepa2_ac_vit_giant"

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


@app.get("/api/model-info")
async def get_model_info():
    """Get information about the V-JEPA2 Giant model."""
    return {
        "id": "vjepa2_ac_vit_giant",
        "name": "V-JEPA2 AC ViT-Giant",
        "type": "action_conditioned",
        "params": "1B",
        "resolution": 256,
        "description": "Action-conditioned model with encoder + predictor. 11GB download."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
