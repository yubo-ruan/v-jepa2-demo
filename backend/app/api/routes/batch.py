"""Batch planning API routes."""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.models.schemas import PlanningRequest, ActionResult
from app.services.planner import planner, PlanningTask

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batch", tags=["batch"])


class BatchPlanningRequest(BaseModel):
    """Request to start batch planning."""
    tasks: List[PlanningRequest]
    parallel: bool = True  # Run tasks in parallel or sequential
    max_concurrent: int = Field(default=4, ge=1, le=10)


class BatchTaskStatus(BaseModel):
    """Status of a single task in the batch."""
    task_id: str
    index: int
    status: str
    progress_percent: float = 0
    result: Optional[ActionResult] = None
    error: Optional[str] = None


class BatchStatus(BaseModel):
    """Overall batch status."""
    batch_id: str
    status: str  # queued, running, completed, partial, failed
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    tasks: List[BatchTaskStatus]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# In-memory batch storage
_batches: Dict[str, BatchStatus] = {}
_batch_tasks: Dict[str, List[str]] = {}  # batch_id -> [task_ids]


@router.post("", response_model=BatchStatus)
async def create_batch(request: BatchPlanningRequest):
    """
    Start a batch planning job.

    Runs multiple planning tasks either in parallel or sequentially.
    """
    if not request.tasks:
        raise HTTPException(status_code=400, detail="No tasks provided")

    batch_id = str(uuid.uuid4())

    # Create individual tasks
    task_ids = []
    task_statuses = []

    for i, task_req in enumerate(request.tasks):
        task_id = planner.create_task(task_req)
        task_ids.append(task_id)
        task_statuses.append(BatchTaskStatus(
            task_id=task_id,
            index=i,
            status="queued",
            progress_percent=0,
        ))

    batch = BatchStatus(
        batch_id=batch_id,
        status="queued",
        total_tasks=len(request.tasks),
        completed_tasks=0,
        failed_tasks=0,
        tasks=task_statuses,
        started_at=datetime.now(),
    )

    _batches[batch_id] = batch
    _batch_tasks[batch_id] = task_ids

    # Start batch processing in background
    asyncio.create_task(_run_batch(batch_id, request.parallel, request.max_concurrent))

    return batch


async def _run_batch(batch_id: str, parallel: bool, max_concurrent: int):
    """Run batch tasks."""
    batch = _batches.get(batch_id)
    if not batch:
        return

    batch.status = "running"
    task_ids = _batch_tasks.get(batch_id, [])

    if parallel:
        # Run with limited concurrency
        semaphore = asyncio.Semaphore(max_concurrent)

        async def run_with_semaphore(task_id: str, index: int):
            async with semaphore:
                await _run_single_task(batch_id, task_id, index)

        await asyncio.gather(*[
            run_with_semaphore(tid, i)
            for i, tid in enumerate(task_ids)
        ])
    else:
        # Run sequentially
        for i, task_id in enumerate(task_ids):
            await _run_single_task(batch_id, task_id, i)

    # Update final status
    batch.completed_at = datetime.now()
    if batch.failed_tasks == 0:
        batch.status = "completed"
    elif batch.completed_tasks == 0:
        batch.status = "failed"
    else:
        batch.status = "partial"


async def _run_single_task(batch_id: str, task_id: str, index: int) -> None:
    """Run a single task within a batch with timeout."""
    batch = _batches.get(batch_id)
    if not batch or index >= len(batch.tasks):
        return

    task_status = batch.tasks[index]
    task_status.status = "running"
    timeout = settings.batch_task_timeout_seconds

    try:
        # Progress callback
        async def on_progress(progress):
            task_status.progress_percent = (progress.iteration / progress.total_iterations) * 100

        # Run with timeout
        result = await asyncio.wait_for(
            planner.run_planning(task_id, on_progress),
            timeout=timeout
        )
        task_status.status = "completed"
        task_status.result = result
        task_status.progress_percent = 100
        batch.completed_tasks += 1
        logger.info(f"Batch task {task_id} completed successfully")

    except asyncio.TimeoutError:
        task_status.status = "failed"
        task_status.error = f"Task timed out after {timeout} seconds"
        batch.failed_tasks += 1
        logger.warning(f"Batch task {task_id} timed out after {timeout}s")

    except Exception as e:
        task_status.status = "failed"
        task_status.error = str(e)
        batch.failed_tasks += 1
        logger.error(f"Batch task {task_id} failed: {e}")


@router.get("/{batch_id}", response_model=BatchStatus)
async def get_batch_status(batch_id: str):
    """Get the status of a batch job."""
    if batch_id not in _batches:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _batches[batch_id]


@router.post("/{batch_id}/cancel")
async def cancel_batch(batch_id: str):
    """Cancel all pending tasks in a batch."""
    if batch_id not in _batches:
        raise HTTPException(status_code=404, detail="Batch not found")

    batch = _batches[batch_id]
    task_ids = _batch_tasks.get(batch_id, [])

    cancelled = 0
    for task_id in task_ids:
        if planner.cancel_task(task_id):
            cancelled += 1

    return {
        "batch_id": batch_id,
        "cancelled_tasks": cancelled,
        "total_tasks": len(task_ids),
    }


@router.get("")
async def list_batches(limit: int = 10):
    """List recent batch jobs."""
    batches = sorted(
        _batches.values(),
        key=lambda b: b.started_at or datetime.min,
        reverse=True,
    )[:limit]

    return {
        "batches": [
            {
                "batch_id": b.batch_id,
                "status": b.status,
                "total_tasks": b.total_tasks,
                "completed_tasks": b.completed_tasks,
                "started_at": b.started_at,
                "completed_at": b.completed_at,
            }
            for b in batches
        ],
        "total": len(_batches),
    }
