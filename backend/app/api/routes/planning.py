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
    TrajectoryRequest,
    TrajectoryTaskResponse,
    TrajectoryResultResponse,
    TrajectoryProgress,
    SingleStepRequest,
    SingleStepResponse,
    SingleStepResult,
)
from app.services.planner import planner
from app.services.vjepa2 import get_inference
from app.api.websocket import ws_manager
from app.api.routes.upload import upload_exists
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

    # Validate upload IDs before starting planning
    # This prevents race conditions where WebSocket error is sent before client connects
    current_image = request.current_image
    goal_image = request.goal_image

    # Check if images are upload IDs (UUIDs) and validate they exist
    def is_upload_id(ref: str) -> bool:
        """Check if reference looks like an upload ID (UUID format)."""
        import re
        return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', ref, re.I))

    if is_upload_id(current_image) and not upload_exists(current_image):
        logger.warning(f"Current image upload ID not found: {current_image}")
        raise HTTPException(
            status_code=400,
            detail="Current image upload not found. Please re-upload the image."
        )

    if is_upload_id(goal_image) and not upload_exists(goal_image):
        logger.warning(f"Goal image upload ID not found: {goal_image}")
        raise HTTPException(
            status_code=400,
            detail="Goal image upload not found. Please re-upload the image."
        )

    # Cancel any lingering background tasks to prevent memory leaks and stuck progress
    # IMPORTANT: Don't await the old tasks - they may be blocked on GPU computation
    # which can take a long time. Just signal cancellation and move on.
    if _background_tasks:
        logger.info(f"Cancelling {len(_background_tasks)} lingering background task(s)")
        for old_task_id, old_task in list(_background_tasks.items()):
            if not old_task.done():
                old_task.cancel()
                # Don't await here - the task runs CEM in a thread pool which may take
                # seconds to complete. The cancel() signal will be picked up on the next
                # iteration of CEM when it checks task.cancelled.
                logger.info(f"Sent cancellation to task {old_task_id}")
            # Use pop() instead of del to avoid KeyError if task was already removed
            _background_tasks.pop(old_task_id, None)
        logger.info("Cancellation signals sent to all lingering tasks")

    task_id = planner.create_task(request)
    logger.info(f"[Planning] Created task {task_id}, creating background task...")

    # Start background task
    bg_task = asyncio.create_task(_run_planning_with_ws(task_id))
    _background_tasks[task_id] = bg_task
    logger.info(f"[Planning] Background task created for {task_id}, returning response")

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

        # CRITICAL: Clear cache after evaluation to prevent memory buildup
        # This is essential for stable multi-step planning
        inference.clear_cache(aggressive=True)

        # Explicitly delete PIL Image objects
        del current_img
        del goal_img

        return EvaluateActionsResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Energy evaluation failed: {str(e)}")


# =============================================================================
# Trajectory Planning Endpoints
# =============================================================================

async def _run_trajectory_with_ws(task_id: str):
    """Run trajectory planning and broadcast progress via WebSocket."""
    import logging
    logger = logging.getLogger(__name__)

    async def progress_callback(progress: TrajectoryProgress):
        await ws_manager.broadcast_trajectory_progress(task_id, progress.model_dump())

    try:
        logger.info(f"[Trajectory] Starting trajectory planning for task {task_id}")
        result = await planner.run_trajectory_planning(task_id, progress_callback)
        logger.info(f"[Trajectory] Planning completed for task {task_id}")
        await ws_manager.broadcast_trajectory_completed(task_id, result.model_dump())
    except asyncio.CancelledError:
        logger.info(f"[Trajectory] Task {task_id} cancelled")
        await ws_manager.broadcast_cancelled(task_id)
    except Exception as e:
        logger.error(f"[Trajectory] Task {task_id} failed with error: {e}")
        await ws_manager.broadcast_error(task_id, str(e))
    finally:
        if task_id in _background_tasks:
            del _background_tasks[task_id]


@router.post("/trajectory", response_model=TrajectoryTaskResponse)
async def create_trajectory_task(request: TrajectoryRequest):
    """
    Start a new trajectory planning task.

    This generates a sequence of actions (trajectory) to reach the goal.
    Uses sequential CEM planning: each step plans from current→goal,
    then simulates the state transition for the next step.

    Args:
        request: Contains current/goal images, num_steps, model, samples, iterations

    Returns:
        task_id: Use this to subscribe to WebSocket updates or poll status
    """
    import logging
    logger = logging.getLogger(__name__)

    # Validate images exist
    current_image = request.current_image
    goal_image = request.goal_image

    def is_upload_id(ref: str) -> bool:
        import re
        return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', ref, re.I))

    if is_upload_id(current_image) and not upload_exists(current_image):
        raise HTTPException(status_code=400, detail="Current image upload not found")

    if is_upload_id(goal_image) and not upload_exists(goal_image):
        raise HTTPException(status_code=400, detail="Goal image upload not found")

    # Cancel lingering tasks
    if _background_tasks:
        logger.info(f"Cancelling {len(_background_tasks)} lingering background task(s)")
        for old_task_id, old_task in list(_background_tasks.items()):
            if not old_task.done():
                old_task.cancel()
            _background_tasks.pop(old_task_id, None)

    task_id = planner.create_trajectory_task(request)
    logger.info(f"[Trajectory] Created task {task_id} with {request.num_steps} steps")

    # Start background task
    bg_task = asyncio.create_task(_run_trajectory_with_ws(task_id))
    _background_tasks[task_id] = bg_task

    return TrajectoryTaskResponse(
        task_id=task_id,
        status="queued",
        websocket_url=f"/ws/plan/{task_id}",
    )


@router.get("/trajectory/{task_id}", response_model=TrajectoryResultResponse)
async def get_trajectory_status(task_id: str):
    """Get the current status and result of a trajectory planning task."""
    task = planner.get_trajectory_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Trajectory task not found")

    return TrajectoryResultResponse(
        task_id=task.id,
        status=task.status,
        progress=task.progress,
        result=task.result,
        error=task.error,
    )


@router.post("/trajectory/{task_id}/cancel")
async def cancel_trajectory_task(task_id: str):
    """Cancel a running trajectory planning task."""
    task = planner.get_trajectory_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Trajectory task not found")

    if task.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot cancel task with status: {task.status}")

    success = planner.cancel_trajectory_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to cancel task")

    return {"status": "cancelled", "task_id": task_id}


# =============================================================================
# Single-Step Trajectory Planning (Step-by-Step Mode)
# =============================================================================

@router.post("/trajectory/step", response_model=SingleStepResponse)
async def plan_trajectory_step(request: SingleStepRequest):
    """
    Plan a single trajectory step (step-by-step mode).

    This endpoint is used for interactive trajectory planning where:
    - User provides a real observation from the simulator after each step
    - No embedding rollout - each step uses actual visual feedback
    - Returns synchronously after CEM completes

    Args:
        request: Contains current_image (from simulator), goal_image, model, samples, iterations, step_index

    Returns:
        SingleStepResponse with action, energy, confidence for this step
    """
    import logging
    logger = logging.getLogger(__name__)

    # Validate images exist
    def is_upload_id(ref: str) -> bool:
        import re
        return bool(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', ref, re.I))

    if is_upload_id(request.current_image) and not upload_exists(request.current_image):
        return SingleStepResponse(
            success=False,
            error="Current image upload not found. Please re-upload from simulator."
        )

    if is_upload_id(request.goal_image) and not upload_exists(request.goal_image):
        return SingleStepResponse(
            success=False,
            error="Goal image upload not found. Please re-upload the goal image."
        )

    logger.info(f"[SingleStep] Starting step {request.step_index} planning...")

    try:
        result = await planner.run_single_step_planning(
            current_image_id=request.current_image,
            goal_image_id=request.goal_image,
            model_id=request.model,
            samples=request.samples,
            iterations=request.iterations,
            step_index=request.step_index,
        )

        return SingleStepResponse(
            success=True,
            result=SingleStepResult(**result),
        )

    except Exception as e:
        logger.error(f"[SingleStep] Step {request.step_index} failed: {e}", exc_info=True)
        return SingleStepResponse(
            success=False,
            error=str(e),
        )
