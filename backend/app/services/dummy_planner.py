"""Dummy planning service that simulates CEM optimization."""

import asyncio
import random
import time
import uuid
from typing import Dict, Callable, Optional
from dataclasses import dataclass, field

from app.models.schemas import (
    PlanningRequest,
    PlanningProgress,
    ActionResult,
    PlanningResultResponse,
)
from app.config import settings


@dataclass
class PlanningTask:
    """Represents a planning task."""
    id: str
    request: PlanningRequest
    status: str = "queued"
    progress: Optional[PlanningProgress] = None
    result: Optional[ActionResult] = None
    error: Optional[str] = None
    cancelled: bool = False
    start_time: Optional[float] = None


class DummyPlannerService:
    """
    Simulates the CEM planning process with realistic-looking progress.

    This generates fake but plausible results for testing the UX flow.
    """

    def __init__(self):
        self.tasks: Dict[str, PlanningTask] = {}
        self._running_tasks: Dict[str, asyncio.Task] = {}

    def create_task(self, request: PlanningRequest) -> str:
        """Create a new planning task."""
        task_id = str(uuid.uuid4())
        task = PlanningTask(id=task_id, request=request)
        self.tasks[task_id] = task
        return task_id

    def get_task(self, task_id: str) -> Optional[PlanningTask]:
        """Get a task by ID."""
        return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task."""
        task = self.tasks.get(task_id)
        if task and task.status == "running":
            task.cancelled = True
            task.status = "cancelled"
            return True
        return False

    async def run_planning(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[PlanningProgress], None]] = None,
    ) -> ActionResult:
        """
        Simulate the CEM planning process.

        Generates realistic-looking progress updates and final results.
        """
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task.status = "running"
        task.start_time = time.time()

        iterations = task.request.iterations
        samples = task.request.samples

        # Generate a target energy that we'll converge toward
        # Lower is better, typically 0.5 - 3.0
        target_energy = random.uniform(0.8, 2.5)

        # Starting energy (higher)
        current_energy = random.uniform(6.0, 10.0)

        # Generate the final action we'll converge to
        final_action = [
            round(random.uniform(-5.0, 5.0), 2),  # x
            round(random.uniform(-5.0, 5.0), 2),  # y
            round(random.uniform(-2.0, 2.0), 2),  # z
        ]

        energy_history = []

        for iteration in range(1, iterations + 1):
            if task.cancelled:
                task.status = "cancelled"
                raise asyncio.CancelledError("Task cancelled by user")

            # Simulate processing time
            await asyncio.sleep(settings.dummy_iteration_delay)

            # Calculate energy with exponential decay + noise
            progress_ratio = iteration / iterations
            decay = (1 - progress_ratio) ** 1.5
            noise = random.uniform(-0.1, 0.1) * (1 - progress_ratio)
            current_energy = target_energy + (current_energy - target_energy) * decay + noise
            current_energy = max(target_energy * 0.95, current_energy)  # Don't go below target

            energy_history.append(round(current_energy, 3))

            # Calculate elapsed and ETA
            elapsed = time.time() - task.start_time
            avg_time_per_iter = elapsed / iteration
            eta = avg_time_per_iter * (iterations - iteration)

            # Create progress update
            progress = PlanningProgress(
                iteration=iteration,
                total_iterations=iterations,
                best_energy=round(min(energy_history), 3),
                samples_evaluated=iteration * samples,
                elapsed_seconds=round(elapsed, 1),
                eta_seconds=round(eta, 1),
            )

            task.progress = progress

            # Send progress callback
            if progress_callback:
                await progress_callback(progress)

        # Calculate confidence from final energy
        # Lower energy = higher confidence
        # Energy of 1.0 -> ~90% confidence, Energy of 3.0 -> ~60% confidence
        confidence = max(0.4, min(0.95, 1.0 - (min(energy_history) - 0.5) * 0.15))
        confidence = round(confidence, 2)

        # Create final result
        result = ActionResult(
            action=final_action,
            confidence=confidence,
            energy=round(min(energy_history), 3),
            energy_history=energy_history,
        )

        task.result = result
        task.status = "completed"

        return result


# Singleton instance
dummy_planner = DummyPlannerService()
