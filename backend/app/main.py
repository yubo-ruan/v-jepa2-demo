"""FastAPI application entry point."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import planning, models, experiments, upload, health, system, export, batch
from app.api.websocket import ws_manager
from app.services.dummy_planner import dummy_planner
from app.services.dummy_download import dummy_download

# Create FastAPI app
app = FastAPI(
    title="V-JEPA2 Planning API",
    description="Backend API for V-JEPA2 action planning demo",
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


# WebSocket endpoint for planning progress
@app.websocket("/ws/plan/{task_id}")
async def websocket_planning(websocket: WebSocket, task_id: str):
    """
    WebSocket endpoint for real-time planning progress.

    Connect to receive progress updates for a specific planning task.
    Messages are JSON with format: {"type": "progress|completed|error", "data": {...}}
    """
    # Check if task exists
    task = dummy_planner.get_task(task_id)
    if not task:
        await websocket.close(code=4004, reason="Task not found")
        return

    await ws_manager.connect(task_id, websocket)

    try:
        # If task already completed, send result immediately
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

        # Keep connection open to receive updates
        while True:
            # Wait for messages from client (ping/pong, cancel requests)
            data = await websocket.receive_text()
            if data == "cancel":
                dummy_planner.cancel_task(task_id)
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
        "mode": "dummy" if settings.dummy_mode else "production",
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
