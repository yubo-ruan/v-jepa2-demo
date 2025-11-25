"""Planning API routes."""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from typing import Dict

from app.models.schemas import (
    PlanningRequest,
    PlanningTaskResponse,
    PlanningResultResponse,
    PlanningProgress,
)
from app.services.dummy_planner import dummy_planner
from app.api.websocket import ws_manager
from app.config import settings

router = APIRouter(prefix="/plan", tags=["planning"])

# Track background tasks
_background_tasks: Dict[str, asyncio.Task] = {}


async def _run_planning_with_ws(task_id: str):
    """Run planning and broadcast progress via WebSocket."""

    async def progress_callback(progress: PlanningProgress):
        await ws_manager.broadcast_progress(task_id, progress.model_dump())

    try:
        result = await dummy_planner.run_planning(task_id, progress_callback)
        await ws_manager.broadcast_completed(task_id, result.model_dump())
    except asyncio.CancelledError:
        await ws_manager.broadcast_cancelled(task_id)
    except Exception as e:
        await ws_manager.broadcast_error(task_id, str(e))
    finally:
        # Clean up
        if task_id in _background_tasks:
            del _background_tasks[task_id]


@router.post("", response_model=PlanningTaskResponse)
async def create_planning_task(request: PlanningRequest):
    """
    Start a new planning task.

    Returns a task ID that can be used to:
    - Poll for status via GET /api/plan/{task_id}
    - Subscribe to real-time updates via WebSocket /ws/plan/{task_id}
    """
    task_id = dummy_planner.create_task(request)

    # Start background task
    bg_task = asyncio.create_task(_run_planning_with_ws(task_id))
    _background_tasks[task_id] = bg_task

    return PlanningTaskResponse(
        task_id=task_id,
        status="queued",
        websocket_url=f"/ws/plan/{task_id}",
    )


@router.get("/{task_id}", response_model=PlanningResultResponse)
async def get_planning_status(task_id: str):
    """Get the current status and result of a planning task."""
    task = dummy_planner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return PlanningResultResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        result=task.result,
        error=task.error,
    )


@router.post("/{task_id}/cancel")
async def cancel_planning_task(task_id: str):
    """Cancel a running planning task."""
    task = dummy_planner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot cancel task with status: {task.status}")

    success = dummy_planner.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel task")

    return {"status": "cancelled", "task_id": task_id}
