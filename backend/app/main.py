"""FastAPI application entry point."""

import logging
import sys

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import (
    planning, models, experiments, upload, health, system, export, batch,
    video, trajectory, compare, presets, analytics
)
from app.api.websocket import ws_manager
from app.services.planner import planner

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Reduce noise from uvicorn access logs
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="V-JEPA2 Planning API",
    description="Backend API for V-JEPA2 action planning demo with real inference",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(planning.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(experiments.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(batch.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(trajectory.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(presets.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    """Log startup information."""
    logger.info(f"Starting V-JEPA2 API server with real inference")
    logger.info(f"Default model: {settings.default_model}")
    logger.info(f"CORS origins: {settings.cors_origins}")


# WebSocket endpoint for planning progress
@app.websocket("/ws/plan/{task_id}")
async def websocket_planning(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for real-time planning progress.

    Connect to receive progress updates for a specific planning task.
    Messages are JSON with format: {"type": "progress|completed|error", "data": {...}}
    """
    # Check if task exists
    task = planner.get_task(task_id)
    if not task:
        await websocket.close(code=4004, reason="Task not found")
        return

    await ws_manager.connect(task_id, websocket)

    try:
        # Send current state immediately based on task status
        if task.status == "completed" and task.result:
            await websocket.send_json({
                "type": "completed",
                "data": task.result.model_dump()
            })
        elif task.status == "failed":
            await websocket.send_json({
                "type": "error",
                "data": {"message": task.error or "Unknown error"}
            })
        elif task.status == "cancelled":
            await websocket.send_json({"type": "cancelled", "data": {}})
        elif task.status == "running" and task.progress:
            # Send current progress (including loading_model status)
            await websocket.send_json({
                "type": "progress",
                "data": task.progress.model_dump()
            })

        # Keep connection open to receive updates
        while True:
            # Wait for messages from client (ping/pong, cancel requests)
            data = await websocket.receive_text()
            if data == "cancel":
                planner.cancel_task(task_id)
                await websocket.send_json({"type": "cancelled", "data": {}})
                break

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(task_id, websocket)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "V-JEPA2 Planning API",
        "version": "1.0.0",
        "mode": "real",
        "default_model": settings.default_model,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
