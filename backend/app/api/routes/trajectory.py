"""Action trajectory API for multi-step planning."""

import asyncio
import logging
import math
import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.websocket import ws_manager
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trajectory", tags=["trajectory"])


class TrajectoryStep(BaseModel):
    """Single step in a trajectory."""
    step_index: int
    action: List[float]  # [x, y, z] displacement
    confidence: float
    energy: float
    predicted_state_url: Optional[str] = None


class TrajectoryRequest(BaseModel):
    """Request for multi-step trajectory planning."""
    current_image: str  # base64 or upload_id
    goal_image: str
    model: str = "vit-giant"
    num_steps: int = Field(default=5, ge=1, le=20)
    planning_horizon: int = Field(default=10, ge=1, le=50)
    samples_per_step: int = Field(default=100, ge=10, le=1000)


class TrajectoryResult(BaseModel):
    """Complete trajectory planning result."""
    trajectory_id: str
    status: str  # queued, planning, completed, failed, cancelled
    num_steps: int
    steps: List[TrajectoryStep] = []
    total_energy: float = 0
    average_confidence: float = 0
    planning_time_seconds: float = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


class ExecutionStatus(BaseModel):
    """Trajectory execution simulation status."""
    trajectory_id: str
    current_step: int
    total_steps: int
    status: str  # idle, executing, paused, completed, failed
    executed_actions: List[List[float]] = []


# In-memory storage
_trajectories: Dict[str, TrajectoryResult] = {}
_executions: Dict[str, ExecutionStatus] = {}


def _generate_trajectory_step(
    step_index: int,
    goal_direction: List[float],
    prev_actions: List[List[float]],
) -> TrajectoryStep:
    """Generate a simulated trajectory step."""
    # Simulate action toward goal with some noise
    base_action = [d * (1.0 - step_index * 0.1) for d in goal_direction]

    # Add some realistic noise and variation
    action = [
        base_action[0] + random.gauss(0, 0.3),
        base_action[1] + random.gauss(0, 0.3),
        base_action[2] + random.gauss(0, 0.2),
    ]

    # Clip to reasonable bounds
    action = [max(-5, min(5, a)) for a in action]

    # Confidence decreases slightly for later steps
    confidence = 0.95 - step_index * 0.05 + random.uniform(-0.05, 0.05)
    confidence = max(0.5, min(0.99, confidence))

    # Energy should decrease as we approach goal
    energy = 3.0 * (1.0 - step_index * 0.15) + random.uniform(0, 0.5)
    energy = max(0.5, energy)

    return TrajectoryStep(
        step_index=step_index,
        action=[round(a, 3) for a in action],
        confidence=round(confidence, 3),
        energy=round(energy, 3),
    )


@router.post("/plan", response_model=TrajectoryResult)
async def plan_trajectory(request: TrajectoryRequest):
    """
    Plan a multi-step action trajectory from current to goal state.

    Uses iterative planning with rollout simulation.
    Returns a sequence of actions to execute.
    """
    trajectory_id = str(uuid.uuid4())

    result = TrajectoryResult(
        trajectory_id=trajectory_id,
        status="queued",
        num_steps=request.num_steps,
        created_at=datetime.now(),
    )
    _trajectories[trajectory_id] = result

    # Start planning in background
    asyncio.create_task(_run_trajectory_planning(trajectory_id, request))

    return result


async def _run_trajectory_planning(trajectory_id: str, request: TrajectoryRequest):
    """Run trajectory planning with progress updates."""
    result = _trajectories.get(trajectory_id)
    if not result:
        return

    result.status = "planning"
    start_time = datetime.now()

    # Simulate a goal direction (would come from image embedding comparison)
    goal_direction = [
        random.uniform(-2, 2),
        random.uniform(-2, 2),
        random.uniform(-1, 1),
    ]

    prev_actions: List[List[float]] = []

    for step in range(request.num_steps):
        # Simulate planning time per step
        await asyncio.sleep(settings.dummy_iteration_delay * 2)

        # Generate step
        trajectory_step = _generate_trajectory_step(step, goal_direction, prev_actions)
        result.steps.append(trajectory_step)
        prev_actions.append(trajectory_step.action)

        # Update aggregates
        result.total_energy = sum(s.energy for s in result.steps)
        result.average_confidence = sum(s.confidence for s in result.steps) / len(result.steps)

        # Broadcast progress
        await ws_manager.send_message(trajectory_id, {
            "type": "progress",
            "data": {
                "step": step + 1,
                "total_steps": request.num_steps,
                "latest_action": trajectory_step.action,
                "confidence": trajectory_step.confidence,
                "energy": trajectory_step.energy,
            },
        })

    result.status = "completed"
    result.completed_at = datetime.now()
    result.planning_time_seconds = (result.completed_at - start_time).total_seconds()

    logger.info(f"Trajectory planning completed: {trajectory_id}, {len(result.steps)} steps")

    await ws_manager.send_message(trajectory_id, {
        "type": "completed",
        "data": result.model_dump(),
    })


@router.get("/{trajectory_id}", response_model=TrajectoryResult)
async def get_trajectory(trajectory_id: str):
    """Get trajectory planning result."""
    if trajectory_id not in _trajectories:
        raise HTTPException(status_code=404, detail="Trajectory not found")
    return _trajectories[trajectory_id]


@router.post("/{trajectory_id}/cancel")
async def cancel_trajectory(trajectory_id: str):
    """Cancel ongoing trajectory planning."""
    if trajectory_id not in _trajectories:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    result = _trajectories[trajectory_id]
    if result.status == "planning":
        result.status = "cancelled"
        return {"status": "cancelled", "trajectory_id": trajectory_id}

    return {"status": result.status, "message": "Cannot cancel - planning not in progress"}


@router.post("/{trajectory_id}/execute", response_model=ExecutionStatus)
async def start_execution(trajectory_id: str):
    """
    Start simulated execution of a planned trajectory.

    In production, this would send commands to a robot.
    """
    if trajectory_id not in _trajectories:
        raise HTTPException(status_code=404, detail="Trajectory not found")

    result = _trajectories[trajectory_id]
    if result.status != "completed":
        raise HTTPException(status_code=400, detail="Trajectory not ready for execution")

    execution = ExecutionStatus(
        trajectory_id=trajectory_id,
        current_step=0,
        total_steps=len(result.steps),
        status="executing",
    )
    _executions[trajectory_id] = execution

    # Start execution simulation in background
    asyncio.create_task(_run_execution(trajectory_id))

    return execution


async def _run_execution(trajectory_id: str):
    """Simulate trajectory execution."""
    execution = _executions.get(trajectory_id)
    trajectory = _trajectories.get(trajectory_id)

    if not execution or not trajectory:
        return

    for i, step in enumerate(trajectory.steps):
        # Simulate execution time
        await asyncio.sleep(0.5)

        execution.current_step = i + 1
        execution.executed_actions.append(step.action)

        await ws_manager.send_message(f"exec_{trajectory_id}", {
            "type": "step_executed",
            "data": {
                "step": i + 1,
                "total_steps": execution.total_steps,
                "action": step.action,
            },
        })

    execution.status = "completed"
    logger.info(f"Trajectory execution completed: {trajectory_id}")

    await ws_manager.send_message(f"exec_{trajectory_id}", {
        "type": "execution_completed",
        "data": execution.model_dump(),
    })


@router.get("/{trajectory_id}/execution", response_model=ExecutionStatus)
async def get_execution_status(trajectory_id: str):
    """Get trajectory execution status."""
    if trajectory_id not in _executions:
        raise HTTPException(status_code=404, detail="No execution found for this trajectory")
    return _executions[trajectory_id]


@router.post("/{trajectory_id}/execution/pause")
async def pause_execution(trajectory_id: str):
    """Pause trajectory execution."""
    if trajectory_id not in _executions:
        raise HTTPException(status_code=404, detail="No execution found")

    execution = _executions[trajectory_id]
    if execution.status == "executing":
        execution.status = "paused"

    return execution


@router.post("/{trajectory_id}/execution/resume")
async def resume_execution(trajectory_id: str):
    """Resume paused trajectory execution."""
    if trajectory_id not in _executions:
        raise HTTPException(status_code=404, detail="No execution found")

    execution = _executions[trajectory_id]
    if execution.status == "paused":
        execution.status = "executing"
        # Would restart execution from current step

    return execution


@router.get("")
async def list_trajectories(limit: int = 20):
    """List recent trajectories."""
    trajectories = sorted(
        _trajectories.values(),
        key=lambda t: t.created_at,
        reverse=True
    )[:limit]

    return {
        "trajectories": [
            {
                "trajectory_id": t.trajectory_id,
                "status": t.status,
                "num_steps": t.num_steps,
                "completed_steps": len(t.steps),
                "total_energy": t.total_energy,
                "average_confidence": t.average_confidence,
                "created_at": t.created_at,
            }
            for t in trajectories
        ],
        "total": len(_trajectories),
    }
