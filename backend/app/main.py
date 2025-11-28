"""FastAPI application entry point."""

import logging
import sys

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import (
    planning, models, experiments, upload, health, system, export, batch,
    video, trajectory, compare, presets, analytics, simulator, libero
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
app.include_router(simulator.router, prefix="/api")
app.include_router(libero.router, prefix="/api")


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
    Supports both regular planning tasks and trajectory planning tasks.
    Messages are JSON with format: {"type": "progress|completed|error", "data": {...}}
    """
    # Check if task exists (regular planning or trajectory)
    task = planner.get_task(task_id)
    trajectory_task = planner.get_trajectory_task(task_id)

    if not task and not trajectory_task:
        await websocket.close(code=4004, reason="Task not found")
        return

    # Use whichever task type exists
    active_task = task or trajectory_task
    is_trajectory = trajectory_task is not None

    await ws_manager.connect(task_id, websocket)

    try:
        # Send current state immediately based on task status
        if active_task.status == "completed" and active_task.result:
            msg_type = "trajectory_completed" if is_trajectory else "completed"
            await websocket.send_json({
                "type": msg_type,
                "data": active_task.result.model_dump()
            })
        elif active_task.status == "failed":
            await websocket.send_json({
                "type": "error",
                "data": {"message": active_task.error or "Unknown error"}
            })
        elif active_task.status == "cancelled":
            await websocket.send_json({"type": "cancelled", "data": {}})
        elif active_task.status == "running" and active_task.progress:
            # Send current progress (including loading_model status)
            msg_type = "trajectory_progress" if is_trajectory else "progress"
            await websocket.send_json({
                "type": msg_type,
                "data": active_task.progress.model_dump()
            })

        # Keep connection open to receive updates
        while True:
            # Wait for messages from client (ping/pong, cancel requests)
            data = await websocket.receive_text()
            if data == "cancel":
                # Cancel the appropriate task type
                if is_trajectory:
                    planner.cancel_trajectory_task(task_id)
                else:
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
