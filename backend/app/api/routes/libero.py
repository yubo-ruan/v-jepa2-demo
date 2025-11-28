"""LIBERO Benchmark API routes."""

import asyncio
import logging
import base64
import io
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.libero_sim import get_libero_simulator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/libero", tags=["libero"])


class TaskInitRequest(BaseModel):
    """Request to initialize a LIBERO task."""
    suite_id: str
    task_id: int


class ActionRequest(BaseModel):
    """Request to execute an action."""
    action: list[float]  # 7-DOF action


@router.get("/status")
async def get_libero_status():
    """
    Get LIBERO simulator status.

    Returns:
        Status information including availability and current task
    """
    try:
        sim = get_libero_simulator()
        status = sim.get_status()
        return {
            "available": status["available"],
            "initialized": status["initialized"],
            "current_suite": status["current_suite"],
            "current_task_id": status["current_task_id"],
            "task_info": status["task_info"],
            "step_count": status.get("step_count", 0),
        }
    except Exception as e:
        logger.error(f"[LIBERO] Failed to get status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suites")
async def get_task_suites():
    """
    Get all available LIBERO task suites.

    Returns:
        Dictionary of task suites with metadata
    """
    try:
        sim = get_libero_simulator()
        suites = sim.get_task_suites()
        return {"suites": suites}
    except Exception as e:
        logger.error(f"[LIBERO] Failed to get task suites: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suites/{suite_id}/tasks")
async def get_suite_tasks(suite_id: str):
    """
    Get all tasks in a specific suite.

    Args:
        suite_id: The task suite identifier

    Returns:
        List of tasks with metadata
    """
    try:
        sim = get_libero_simulator()
        tasks = sim.get_tasks(suite_id)
        return {"suite_id": suite_id, "tasks": tasks}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[LIBERO] Failed to get tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suites/{suite_id}/tasks/{task_id}")
async def get_task_info(suite_id: str, task_id: int):
    """
    Get detailed information about a specific task.

    Args:
        suite_id: The task suite identifier
        task_id: The task index within the suite

    Returns:
        Detailed task information
    """
    try:
        sim = get_libero_simulator()
        task_info = sim.get_task_info(suite_id, task_id)
        return task_info
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[LIBERO] Failed to get task info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/initialize")
async def initialize_task(request: TaskInitRequest):
    """
    Initialize a LIBERO task.

    Args:
        request: Task initialization request with suite_id and task_id

    Returns:
        Initialization result with initial observation image
    """
    logger.info(f"[LIBERO] Initialize task: suite={request.suite_id}, task_id={request.task_id}")

    try:
        sim = get_libero_simulator()

        # Run initialization in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            sim.initialize_task,
            request.suite_id,
            request.task_id
        )

        # Convert image to base64
        if "image" in result:
            buffer = io.BytesIO()
            result["image"].save(buffer, format="JPEG", quality=90)
            result["image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            del result["image"]

        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[LIBERO] Failed to initialize task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/step")
async def step_task(request: ActionRequest):
    """
    Execute an action in the current task.

    Args:
        request: Action request with 7-DOF action values

    Returns:
        Step result with observation, reward, and done flag
    """
    logger.info(f"[LIBERO] Step with action: {[f'{x:.4f}' for x in request.action]}")

    try:
        sim = get_libero_simulator()

        if not sim.is_initialized:
            raise HTTPException(status_code=400, detail="No task initialized")

        if len(request.action) != 7:
            raise HTTPException(status_code=400, detail="Action must be 7-dimensional")

        # Run step in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            sim.step,
            request.action
        )

        # Convert image to base64
        if "image" in result:
            buffer = io.BytesIO()
            result["image"].save(buffer, format="JPEG", quality=90)
            result["image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            del result["image"]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LIBERO] Failed to step: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset")
async def reset_task():
    """
    Reset the current task to initial state.

    Returns:
        Reset result with initial observation
    """
    logger.info("[LIBERO] Reset task")

    try:
        sim = get_libero_simulator()

        if not sim.is_initialized:
            raise HTTPException(status_code=400, detail="No task initialized")

        # Run reset in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, sim.reset)

        # Convert image to base64
        if "image" in result:
            buffer = io.BytesIO()
            result["image"].save(buffer, format="JPEG", quality=90)
            result["image_base64"] = base64.b64encode(buffer.getvalue()).decode("utf-8")
            del result["image"]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[LIBERO] Failed to reset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/close")
async def close_task():
    """
    Close the current task and release resources.

    Returns:
        Success message
    """
    logger.info("[LIBERO] Close task")

    try:
        sim = get_libero_simulator()
        sim.close()
        return {"success": True, "message": "Task closed"}

    except Exception as e:
        logger.error(f"[LIBERO] Failed to close: {e}")
        raise HTTPException(status_code=500, detail=str(e))
