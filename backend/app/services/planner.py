"""Planning service with real V-JEPA2 inference."""

import asyncio
import io
import logging
import time
import uuid
from typing import Dict, Callable, Optional
from dataclasses import dataclass
from collections import OrderedDict

from PIL import Image

from app.models.schemas import (
    PlanningRequest,
    PlanningProgress,
    ActionResult,
)
from app.config import settings

logger = logging.getLogger(__name__)


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


class PlannerService:
    """
    Planning service that uses V-JEPA2 for real inference.

    Optimized for 16GB M4 MacBook with automatic task cleanup.
    """

    # Task cleanup settings optimized for 16GB RAM
    MAX_TASKS = 100  # Keep last 100 tasks
    TASK_TTL_SECONDS = 3600  # 1 hour TTL

    def __init__(self):
        self.tasks: OrderedDict[str, PlanningTask] = OrderedDict()  # LRU ordering
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._vjepa_inference = None
        self._model_loaded = False

    def _get_inference(self, model_id: str = None):
        """Lazy load V-JEPA2 inference service."""
        if self._vjepa_inference is None:
            from app.services.vjepa2 import get_inference, get_model_loader
            self._vjepa_inference = get_inference()

        # Load model (or switch to requested model)
        from app.services.vjepa2 import get_model_loader
        loader = get_model_loader()
        target_model = model_id or settings.default_model

        if not loader.is_loaded(target_model):
            loader.load_model(target_model)
            self._model_loaded = True

        return self._vjepa_inference

    def _cleanup_old_tasks(self):
        """Remove old completed tasks to prevent memory leaks."""
        current_time = time.time()

        # Remove tasks older than TTL
        tasks_to_remove = []
        for task_id, task in list(self.tasks.items()):
            if task.status in ("completed", "failed", "cancelled"):
                if task.start_time and (current_time - task.start_time) > self.TASK_TTL_SECONDS:
                    tasks_to_remove.append(task_id)

        for task_id in tasks_to_remove:
            del self.tasks[task_id]
            logger.debug(f"Cleaned up old task {task_id}")

        # If still over limit, remove oldest completed tasks
        if len(self.tasks) > self.MAX_TASKS:
            completed_tasks = [
                (tid, t) for tid, t in self.tasks.items()
                if t.status in ("completed", "failed", "cancelled")
            ]
            # Sort by start_time (oldest first)
            completed_tasks.sort(key=lambda x: x[1].start_time or 0)

            to_remove = len(self.tasks) - self.MAX_TASKS
            for task_id, _ in completed_tasks[:to_remove]:
                del self.tasks[task_id]
                logger.debug(f"Cleaned up task {task_id} (over limit)")

    def create_task(self, request: PlanningRequest) -> str:
        """Create a new planning task with automatic cleanup."""
        # Clean up old tasks first
        self._cleanup_old_tasks()

        task_id = str(uuid.uuid4())
        task = PlanningTask(id=task_id, request=request)
        self.tasks[task_id] = task

        # Move to end (most recent)
        self.tasks.move_to_end(task_id)

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

    def _load_image_from_upload(self, image_ref: str) -> Optional[Image.Image]:
        """
        Load an image from an upload_id reference.

        Args:
            image_ref: Either an upload_id or base64 string

        Returns:
            PIL Image or None if not found
        """
        # Import here to avoid circular imports
        from app.api.routes.upload import _uploads

        # Check if it's an upload_id
        if image_ref in _uploads:
            upload = _uploads[image_ref]
            return Image.open(io.BytesIO(upload["content"]))

        # Try base64 decode
        if image_ref.startswith("data:image"):
            import base64
            # Remove data URL prefix
            _, data = image_ref.split(",", 1)
            image_bytes = base64.b64decode(data)
            return Image.open(io.BytesIO(image_bytes))

        logger.warning(f"Could not load image from reference: {image_ref[:50]}...")
        return None

    async def run_planning(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[PlanningProgress], None]] = None,
    ) -> ActionResult:
        """
        Run the planning process with real V-JEPA2 CEM optimization.

        This uses the Cross-Entropy Method to find optimal actions by:
        1. Encoding images once at the start
        2. Sampling and evaluating many action candidates
        3. Iteratively refining the action distribution
        """
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        task.status = "running"
        task.start_time = time.time()

        iterations = task.request.iterations
        samples = task.request.samples
        model_id = task.request.model

        # Capture the event loop for async callbacks
        main_loop = asyncio.get_event_loop()

        # Check if model needs to be loaded and send status
        from app.services.vjepa2 import get_model_loader
        loader = get_model_loader()

        if not loader.is_loaded(model_id):
            # Get model size for progress display
            model_size_gb = loader.get_model_size_gb(model_id)
            has_checkpoint = loader.has_checkpoint(model_id)
            is_cached = loader.is_cached(model_id)

            # Determine loading strategy and status message
            # Priority: checkpoint (fastest) > PyTorch Hub cache > download
            if has_checkpoint:
                # Checkpoint exists - fast path (16-40s)
                loading_progress = PlanningProgress(
                    status="loading_model",
                    model_loading=model_id,
                    download_progress=1.0,  # Show as "cached" in UI
                    download_total_gb=model_size_gb,
                    download_downloaded_gb=model_size_gb,
                    download_speed_mbps=None,
                    download_eta_seconds=None,  # Checkpoint load is fast
                    iteration=0,
                    total_iterations=iterations,
                    best_energy=0.0,
                    samples_evaluated=0,
                    elapsed_seconds=0.0,
                    eta_seconds=0.0,
                )
                logger.info(f"Loading {model_id} from checkpoint (fast path)")
            elif is_cached:
                # PyTorch Hub cache exists - medium path (60-120s)
                loading_progress = PlanningProgress(
                    status="loading_model",
                    model_loading=model_id,
                    download_progress=1.0,
                    download_total_gb=model_size_gb,
                    download_downloaded_gb=model_size_gb,
                    download_speed_mbps=None,
                    download_eta_seconds=None,
                    iteration=0,
                    total_iterations=iterations,
                    best_energy=0.0,
                    samples_evaluated=0,
                    elapsed_seconds=0.0,
                    eta_seconds=0.0,
                )
                logger.info(f"Loading {model_id} from PyTorch Hub cache")
            else:
                # Need to download - slow path (3-10+ min)
                loading_progress = PlanningProgress(
                    status="loading_model",
                    model_loading=model_id,
                    download_progress=0.0,
                    download_total_gb=model_size_gb,
                    download_downloaded_gb=0.0,
                    download_speed_mbps=None,
                    download_eta_seconds=model_size_gb * 1024 / 20,  # Assume 20 MB/s initially
                    iteration=0,
                    total_iterations=iterations,
                    best_energy=0.0,
                    samples_evaluated=0,
                    elapsed_seconds=0.0,
                    eta_seconds=0.0,
                )
                logger.info(f"Downloading {model_id} from PyTorch Hub ({model_size_gb:.1f}GB)")

            task.progress = loading_progress

            if progress_callback:
                # Send loading status to WebSocket
                main_loop.call_soon_threadsafe(
                    lambda p=loading_progress: main_loop.create_task(progress_callback(p))
                )
                # Give WebSocket time to send the message
                await asyncio.sleep(0.1)

            # If model is not cached AND no checkpoint, start a background task to poll download progress
            if not is_cached and not has_checkpoint:
                download_start_time = time.time()

                async def poll_download_progress():
                    """Poll download progress with adaptive intervals (20-50% less CPU usage)."""
                    from app.services.vjepa2 import get_download_progress
                    last_downloaded_bytes = 0
                    last_time = download_start_time
                    poll_interval = 0.2  # Start fast for responsiveness

                    while task.status == "running":
                        progress_info = get_download_progress(model_id)
                        if progress_info:
                            downloaded_bytes = progress_info.get("downloaded", 0)
                            total_bytes = progress_info.get("total", 1)
                            downloaded_gb = downloaded_bytes / (1024 ** 3)
                            total_gb = total_bytes / (1024 ** 3)

                            # Calculate speed
                            current_time = time.time()
                            time_delta = current_time - last_time
                            if time_delta > 0.5:  # Update speed every 0.5s
                                bytes_delta = downloaded_bytes - last_downloaded_bytes
                                speed_mbps = (bytes_delta / (1024 ** 2)) / time_delta
                                last_downloaded_bytes = downloaded_bytes
                                last_time = current_time

                                # Calculate ETA
                                remaining_gb = total_gb - downloaded_gb
                                if speed_mbps > 0:
                                    eta_seconds = (remaining_gb * 1024) / speed_mbps
                                else:
                                    eta_seconds = None

                                update = PlanningProgress(
                                    status="loading_model",
                                    model_loading=model_id,
                                    download_progress=downloaded_bytes / total_bytes if total_bytes > 0 else 0,
                                    download_total_gb=round(total_gb, 2),
                                    download_downloaded_gb=round(downloaded_gb, 2),
                                    download_speed_mbps=round(speed_mbps, 1) if speed_mbps > 0 else None,
                                    download_eta_seconds=round(eta_seconds, 0) if eta_seconds else None,
                                    iteration=0,
                                    total_iterations=iterations,
                                    best_energy=0.0,
                                    samples_evaluated=0,
                                    elapsed_seconds=round(current_time - task.start_time, 1),
                                    eta_seconds=0.0,
                                )
                                task.progress = update

                                if progress_callback:
                                    main_loop.call_soon_threadsafe(
                                        lambda p=update: main_loop.create_task(progress_callback(p))
                                    )

                                # Adaptive polling: slow down as download progresses (20-50% less CPU)
                                download_progress = downloaded_bytes / total_bytes if total_bytes > 0 else 0
                                if download_progress < 0.1:
                                    poll_interval = 0.2  # Fast updates at start
                                elif download_progress < 0.5:
                                    poll_interval = 0.5  # Medium updates in middle
                                else:
                                    poll_interval = 1.0  # Slower updates near end

                        await asyncio.sleep(poll_interval)

                        # Check if download is complete
                        if progress_info and progress_info.get("downloaded", 0) >= progress_info.get("total", 1):
                            break

                # Start polling in background (will be cancelled when model load completes)
                poll_task = asyncio.create_task(poll_download_progress())
            else:
                poll_task = None
        else:
            poll_task = None

        # Load images
        logger.info(f"Loading images: current={task.request.current_image[:50]}..., goal={task.request.goal_image[:50]}...")
        current_img = self._load_image_from_upload(task.request.current_image)
        goal_img = self._load_image_from_upload(task.request.goal_image)

        if current_img is None or goal_img is None:
            task.status = "failed"
            error_msg = f"Could not load images. Current image: {'loaded' if current_img else 'FAILED'}, Goal image: {'loaded' if goal_img else 'FAILED'}. Make sure images are uploaded to the backend first."
            task.error = error_msg
            logger.error(error_msg)
            raise ValueError(task.error)

        # Get V-JEPA2 inference service with requested model
        # Run in thread executor so it doesn't block the async event loop
        # This allows the download progress polling to actually run
        inference = await main_loop.run_in_executor(
            None,
            lambda: self._get_inference(model_id)
        )

        # Cancel download progress polling if it was started
        if poll_task:
            poll_task.cancel()
            try:
                await poll_task
            except asyncio.CancelledError:
                pass
        if inference is None:
            task.status = "failed"
            task.error = "V-JEPA2 model not available"
            raise RuntimeError(task.error)

        # Track energy history for progress updates
        energy_history = []

        # Progress callback wrapper for CEM (runs in thread pool)
        def cem_progress(iteration: int, total: int, best_energy: float, best_action):
            nonlocal energy_history

            if task.cancelled:
                raise asyncio.CancelledError("Task cancelled by user")

            energy_history.append(round(best_energy, 3))

            # Calculate elapsed and ETA
            elapsed = time.time() - task.start_time
            avg_time_per_iter = elapsed / iteration if iteration > 0 else 0
            eta = avg_time_per_iter * (total - iteration)

            # Create progress update
            progress = PlanningProgress(
                status="running",
                iteration=iteration,
                total_iterations=total,
                best_energy=round(best_energy, 3),
                energy_history=energy_history.copy(),  # Include accumulated energy history
                samples_evaluated=iteration * samples,
                elapsed_seconds=round(elapsed, 1),
                eta_seconds=round(eta, 1),
            )

            task.progress = progress

            # Send progress callback using thread-safe scheduling
            if progress_callback:
                # Use call_soon_threadsafe to schedule the coroutine from thread pool
                main_loop.call_soon_threadsafe(
                    lambda p=progress: main_loop.create_task(progress_callback(p))
                )

        # Run CEM optimization (in thread pool to avoid blocking)
        try:
            cem_result = await main_loop.run_in_executor(
                None,
                lambda: inference.run_cem(
                    current_image=current_img,
                    goal_image=goal_img,
                    num_samples=samples,
                    num_iterations=iterations,
                    elite_fraction=0.1,
                    progress_callback=cem_progress,
                )
            )
        except asyncio.CancelledError:
            task.status = "cancelled"
            raise
        except Exception as e:
            task.status = "failed"
            error_msg = f"Planning execution failed: {str(e)}"
            task.error = error_msg
            logger.error(error_msg, exc_info=True)
            raise RuntimeError(error_msg) from e

        # Clear tensor cache after planning
        inference.clear_cache()

        # Create final result
        result = ActionResult(
            action=cem_result["action"],
            confidence=cem_result["confidence"],
            energy=cem_result["energy"],
            energy_history=cem_result["energy_history"],
            is_ac_model=cem_result.get("is_ac_model", False),
            # Validation fields
            energy_threshold=cem_result.get("energy_threshold", 3.0),
            passes_threshold=cem_result.get("passes_threshold", False),
            normalized_distance=cem_result.get("normalized_distance", 0.0),
        )

        task.result = result
        task.status = "completed"

        logger.info(
            f"Planning completed: action={result.action}, "
            f"confidence={result.confidence}, "
            f"samples={cem_result.get('samples_evaluated', 'N/A')}"
        )

        # Trigger cleanup after task completion
        self._cleanup_old_tasks()

        return result


# Singleton instance
planner = PlannerService()
