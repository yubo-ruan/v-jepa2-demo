"""Planning API routes."""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from typing import Dict

from app.models.schemas import (
    PlanningRequest,
    PlanningTaskResponse,
    PlanningResultResponse,
    PlanningProgress,
    EvaluateActionsRequest,
    EvaluateActionsResponse,
)
from app.services.planner import planner
from app.services.vjepa2 import get_inference
from app.api.websocket import ws_manager
from app.config import settings

router = APIRouter(prefix="/plan", tags=["planning"])

# Track background tasks
_background_tasks: Dict[str, asyncio.Task] = {}


async def _run_planning_with_ws(task_id: str):
    """Run planning and broadcast progress via WebSocket."""
    import logging
    logger = logging.getLogger(__name__)

    async def progress_callback(progress: PlanningProgress):
        await ws_manager.broadcast_progress(task_id, progress.model_dump())

    try:
        logger.info(f"[Planning] Starting planning for task {task_id}")
        result = await planner.run_planning(task_id, progress_callback)
        logger.info(f"[Planning] Planning completed for task {task_id}, result: {result}")
        logger.info(f"[Planning] About to broadcast completion message...")
        await ws_manager.broadcast_completed(task_id, result.model_dump())
        logger.info(f"[Planning] Completion message broadcast complete")
    except asyncio.CancelledError:
        logger.info(f"[Planning] Task {task_id} cancelled")
        await ws_manager.broadcast_cancelled(task_id)
    except Exception as e:
        logger.error(f"[Planning] Task {task_id} failed with error: {e}")
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
    import logging
    logger = logging.getLogger(__name__)

    # Cancel any lingering background tasks to prevent memory leaks and stuck progress
    if _background_tasks:
        logger.info(f"Cancelling {len(_background_tasks)} lingering background task(s)")
        for old_task_id, old_task in list(_background_tasks.items()):
            if not old_task.done():
                old_task.cancel()
                try:
                    await old_task
                except asyncio.CancelledError:
                    pass
            del _background_tasks[old_task_id]
        logger.info("All lingering background tasks cancelled")

    task_id = planner.create_task(request)

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
    task = planner.get_task(task_id)
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
    task = planner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot cancel task with status: {task.status}")

    success = planner.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel task")

    return {"status": "cancelled", "task_id": task_id}


@router.post("/evaluate-actions", response_model=EvaluateActionsResponse)
async def evaluate_actions(request: EvaluateActionsRequest):
    """
    Evaluate multiple actions and return their energy values.

    This endpoint is used for visualizing the energy landscape by computing
    real model predictions for a grid of action candidates.

    Args:
        request: Contains current/goal images and list of actions to evaluate

    Returns:
        Energy values for each action, min/max, and model type
    """
    try:
        # Parse images using planner's image loading
        current_img = planner._load_image_from_upload(request.current_image)
        goal_img = planner._load_image_from_upload(request.goal_image)

        if current_img is None or goal_img is None:
            raise HTTPException(status_code=400, detail="Failed to load images")

        # Get inference service
        inference = get_inference()

        # Ensure model is loaded
        if not inference.loader.is_loaded():
            # Load the requested model
            await inference.loader.load_model_async(request.model)

        # Evaluate actions
        result = inference.evaluate_actions(
            current_image=current_img,
            goal_image=goal_img,
            actions=request.actions
        )

        return EvaluateActionsResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Energy evaluation failed: {str(e)}")
