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
    TrajectoryRequest,
    TrajectoryProgress,
    TrajectoryResult,
    TrajectoryStep,
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


@dataclass
class TrajectoryTask:
    """Represents a trajectory planning task."""
    id: str
    request: TrajectoryRequest
    status: str = "queued"
    progress: Optional[TrajectoryProgress] = None
    result: Optional[TrajectoryResult] = None
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
        self.trajectory_tasks: OrderedDict[str, TrajectoryTask] = OrderedDict()  # Trajectory tasks
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
        # IMPORTANT: Use get_running_loop() instead of get_event_loop()
        # get_event_loop() is deprecated and can return a different (non-running) loop
        # after the first task completes, causing subsequent tasks to hang
        main_loop = asyncio.get_running_loop()

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

        # CRITICAL: Aggressive memory cleanup BEFORE encoding
        # This prevents SIGSEGV crashes on 16GB systems when running inference
        # after simulator usage. The MPS allocator can get fragmented and
        # fail to allocate memory for encoding even if "enough" memory exists.
        import gc
        import torch

        logger.info("Pre-encoding memory cleanup starting...")

        # First, run garbage collection to free Python objects
        gc.collect()
        gc.collect()  # Second pass catches cyclic references

        # For MPS (Apple Silicon), do aggressive cleanup
        if inference.device.type == "mps":
            torch.mps.synchronize()
            torch.mps.empty_cache()
            # Additional GC passes after MPS sync
            for _ in range(3):
                gc.collect()
            torch.mps.synchronize()
            torch.mps.empty_cache()
            logger.info("MPS memory cleared before encoding")
        elif inference.device.type == "cuda":
            torch.cuda.synchronize()
            torch.cuda.empty_cache()
            gc.collect()
            torch.cuda.empty_cache()
            logger.info("CUDA memory cleared before encoding")

        # Send "Encoding images..." status before CEM starts
        encoding_progress = PlanningProgress(
            status="encoding",
            iteration=0,
            total_iterations=iterations,
            best_energy=0.0,
            samples_evaluated=0,
            elapsed_seconds=0.0,
            eta_seconds=0.0,
        )
        task.progress = encoding_progress

        if progress_callback:
            main_loop.call_soon_threadsafe(
                lambda p=encoding_progress: main_loop.create_task(progress_callback(p))
            )
            # Give WebSocket time to send the message
            await asyncio.sleep(0.05)

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

        # Clear tensor cache after planning (aggressive mode for multi-step planning)
        inference.clear_cache(aggressive=True)

        # Explicitly delete PIL Image objects to free memory
        del current_img
        del goal_img

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

        # Aggressive memory cleanup after task completion
        import gc
        import torch

        gc.collect()

        # Empty GPU cache
        if inference.device.type == "mps":
            torch.mps.synchronize()
            torch.mps.empty_cache()
        elif inference.device.type == "cuda":
            torch.cuda.empty_cache()

        logger.info("Memory cleanup completed")

        # Trigger cleanup after task completion
        self._cleanup_old_tasks()

        return result

    # =========================================================================
    # Trajectory Planning Methods
    # =========================================================================

    def create_trajectory_task(self, request: TrajectoryRequest) -> str:
        """Create a new trajectory planning task."""
        self._cleanup_old_tasks()

        task_id = str(uuid.uuid4())
        task = TrajectoryTask(id=task_id, request=request)
        self.trajectory_tasks[task_id] = task
        self.trajectory_tasks.move_to_end(task_id)

        return task_id

    def get_trajectory_task(self, task_id: str) -> Optional[TrajectoryTask]:
        """Get a trajectory task by ID."""
        return self.trajectory_tasks.get(task_id)

    def cancel_trajectory_task(self, task_id: str) -> bool:
        """Cancel a running trajectory task."""
        task = self.trajectory_tasks.get(task_id)
        if task and task.status == "running":
            task.cancelled = True
            task.status = "cancelled"
            return True
        return False

    async def run_trajectory_planning(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[TrajectoryProgress], None]] = None,
    ) -> TrajectoryResult:
        """
        Run sequential trajectory planning using V-JEPA2 with EMBEDDING-SPACE ROLLOUT.

        Key Architecture Change (v2):
        - Instead of pixel-space rollout (which requires a decoder V-JEPA2 lacks),
          we use EMBEDDING-SPACE rollout with the AC predictor.
        - Step 0: Encode images once, get initial embedding distance
        - For each step: Run CEM from current embedding to goal embedding
        - After each action: Roll forward embedding using predict_next_embedding()
        - Track progress via embedding distance reduction

        This properly leverages V-JEPA2-AC's world model capabilities:
        - AC predictor: (current_embedding, action, state) → predicted_embedding
        - Energy should DECREASE across steps as we approach the goal
        - Each step plans from the PREDICTED state, not the original image
        """
        task = self.trajectory_tasks.get(task_id)
        if not task:
            raise ValueError(f"Trajectory task {task_id} not found")

        task.status = "running"
        task.start_time = time.time()

        num_steps = task.request.num_steps
        iterations = task.request.iterations
        samples = task.request.samples
        model_id = task.request.model

        main_loop = asyncio.get_running_loop()

        # Load model if needed (similar to regular planning)
        from app.services.vjepa2 import get_model_loader
        loader = get_model_loader()

        if not loader.is_loaded(model_id):
            model_size_gb = loader.get_model_size_gb(model_id)
            has_checkpoint = loader.has_checkpoint(model_id)
            is_cached = loader.is_cached(model_id)

            loading_progress = TrajectoryProgress(
                status="loading_model",
                model_loading=model_id,
                download_progress=1.0 if (has_checkpoint or is_cached) else 0.0,
                download_total_gb=model_size_gb,
                download_downloaded_gb=model_size_gb if (has_checkpoint or is_cached) else 0.0,
                current_step=0,
                total_steps=num_steps,
                iteration=0,
                total_iterations=iterations,
                best_energy=0.0,
                samples_evaluated=0,
                elapsed_seconds=0.0,
                eta_seconds=0.0,
                completed_steps=[],
            )
            task.progress = loading_progress

            if progress_callback:
                main_loop.call_soon_threadsafe(
                    lambda p=loading_progress: main_loop.create_task(progress_callback(p))
                )
                await asyncio.sleep(0.1)

        # Load images
        logger.info(f"[Trajectory] Loading images for trajectory task {task_id}")
        current_img = self._load_image_from_upload(task.request.current_image)
        goal_img = self._load_image_from_upload(task.request.goal_image)

        if current_img is None or goal_img is None:
            task.status = "failed"
            task.error = "Could not load images"
            raise ValueError(task.error)

        # Get inference service
        inference = await main_loop.run_in_executor(
            None, lambda: self._get_inference(model_id)
        )

        if inference is None:
            task.status = "failed"
            task.error = "V-JEPA2 model not available"
            raise RuntimeError(task.error)

        # Send encoding status
        encoding_progress = TrajectoryProgress(
            status="encoding",
            current_step=0,
            total_steps=num_steps,
            iteration=0,
            total_iterations=iterations,
            best_energy=0.0,
            samples_evaluated=0,
            elapsed_seconds=0.0,
            eta_seconds=0.0,
            completed_steps=[],
        )
        task.progress = encoding_progress

        if progress_callback:
            main_loop.call_soon_threadsafe(
                lambda p=encoding_progress: main_loop.create_task(progress_callback(p))
            )
            await asyncio.sleep(0.05)

        # =======================================================================
        # EMBEDDING-SPACE ROLLOUT: Encode images ONCE, track embeddings
        # =======================================================================
        import torch

        # Step 0: Encode both images and get initial embeddings
        logger.info("[Trajectory] Encoding images and computing initial distance...")

        def encode_and_get_distance():
            """Encode images and return embeddings + initial distance."""
            # Call encode_images directly (not run_cem which clears cache in finally block)
            # This populates _embedding_cache["current_patches"] and ["goal_patches"] for AC models
            inference.encode_images(current_img, goal_img)

            # Extract cached embeddings (populated by encode_images for AC models)
            current_emb = inference._embedding_cache.get("current_patches")
            goal_emb = inference._embedding_cache.get("goal_patches")

            if current_emb is None or goal_emb is None:
                raise RuntimeError("Failed to get embeddings from cache")

            # Debug: Check if embeddings are actually different
            logger.info(f"[Trajectory] DEBUG: current_emb shape={current_emb.shape}, goal_emb shape={goal_emb.shape}")
            logger.info(f"[Trajectory] DEBUG: current_emb ptr={current_emb.data_ptr()}, goal_emb ptr={goal_emb.data_ptr()}")
            logger.info(f"[Trajectory] DEBUG: current_emb mean={current_emb.mean().item():.6f}, goal_emb mean={goal_emb.mean().item():.6f}")

            # Clone to new tensors (deep copy to ensure independence)
            current_emb = current_emb.clone().detach().contiguous()
            goal_emb = goal_emb.clone().detach().contiguous()

            logger.info(f"[Trajectory] DEBUG: After clone - current ptr={current_emb.data_ptr()}, goal ptr={goal_emb.data_ptr()}")

            # Compute initial distance (L1 mean, same as energy calculation)
            initial_dist = torch.abs(current_emb - goal_emb).mean().item()
            logger.info(f"[Trajectory] DEBUG: Computed initial_dist={initial_dist:.6f}")

            return current_emb, goal_emb, initial_dist

        try:
            current_embedding, goal_embedding, initial_distance = await main_loop.run_in_executor(
                None, encode_and_get_distance
            )
            logger.info(f"[Trajectory] Initial embedding distance: {initial_distance:.4f}")
        except Exception as e:
            task.status = "failed"
            task.error = f"Failed to encode images: {str(e)}"
            logger.error(task.error, exc_info=True)
            raise RuntimeError(task.error) from e

        # Track trajectory state in embedding space
        trajectory_embedding = current_embedding  # Will be rolled forward each step

        # Sequential trajectory planning with embedding rollout
        completed_steps: list[TrajectoryStep] = []

        for step_idx in range(num_steps):
            if task.cancelled:
                raise asyncio.CancelledError("Task cancelled by user")

            logger.info(f"[Trajectory] Step {step_idx + 1}/{num_steps}")

            # Track energy history for this step
            step_energy_history = []

            # CEM progress callback for this step
            def cem_progress_for_step(iteration: int, total: int, best_energy: float, best_action, step=step_idx):
                nonlocal step_energy_history

                if task.cancelled:
                    raise asyncio.CancelledError("Task cancelled by user")

                step_energy_history.append(round(best_energy, 3))

                elapsed = time.time() - task.start_time
                # Estimate total time: (elapsed / (completed_steps + current_progress)) * total_steps
                steps_done = step + (iteration / total if total > 0 else 0)
                if steps_done > 0:
                    eta = (elapsed / steps_done) * (num_steps - steps_done)
                else:
                    eta = 0

                progress = TrajectoryProgress(
                    status="running",
                    current_step=step,
                    total_steps=num_steps,
                    iteration=iteration,
                    total_iterations=total,
                    best_energy=round(best_energy, 3),
                    energy_history=step_energy_history.copy(),
                    samples_evaluated=iteration * samples,
                    elapsed_seconds=round(elapsed, 1),
                    eta_seconds=round(eta, 1),
                    completed_steps=completed_steps.copy(),
                )

                task.progress = progress

                if progress_callback:
                    main_loop.call_soon_threadsafe(
                        lambda p=progress: main_loop.create_task(progress_callback(p))
                    )

            # Run CEM for this step
            # IMPORTANT: Use run_cem_from_embedding for ALL steps to avoid
            # run_cem's finally block clearing the cache and invalidating our embeddings
            try:
                # Capture current values by binding to local variables (avoid closure capture issues)
                current_emb_for_cem = trajectory_embedding.clone().detach()
                goal_emb_for_cem = goal_embedding.clone().detach()
                init_dist_for_cem = initial_distance

                cem_result = await main_loop.run_in_executor(
                    None,
                    lambda curr=current_emb_for_cem, goal=goal_emb_for_cem, dist=init_dist_for_cem:
                        inference.run_cem_from_embedding(
                            current_embedding=curr,
                            goal_embedding=goal,
                            initial_distance=dist,
                            num_samples=samples,
                            num_iterations=iterations,
                            progress_callback=cem_progress_for_step,
                        )
                )
            except asyncio.CancelledError:
                task.status = "cancelled"
                raise
            except Exception as e:
                task.status = "failed"
                task.error = f"CEM failed at step {step_idx}: {str(e)}"
                logger.error(task.error, exc_info=True)
                raise RuntimeError(task.error) from e

            # Roll forward embedding using the action found by CEM
            # This predicts what embedding we would reach AFTER taking this action
            try:
                # Capture current values to avoid closure issues
                emb_to_roll = trajectory_embedding.clone().detach()
                action_to_apply = cem_result["action"]

                def predict_next(emb, action):
                    return inference.predict_next_embedding(
                        current_embedding=emb,
                        action=action,
                    )

                # Roll forward to get predicted next embedding
                trajectory_embedding = await main_loop.run_in_executor(
                    None,
                    lambda e=emb_to_roll, a=action_to_apply: predict_next(e, a)
                )
                logger.info(f"[Trajectory] Rolled forward embedding for step {step_idx + 1}")

            except Exception as e:
                logger.warning(f"[Trajectory] Failed to predict next embedding: {e}")
                # Continue with current embedding - trajectory will be less accurate
                # but still valid (graceful degradation)

            # Now compute distance to goal AFTER rolling forward
            # This shows how close we got after taking this action
            def compute_distance(curr_emb, goal_emb):
                return torch.abs(curr_emb - goal_emb).mean().item()

            # Capture embeddings for lambda
            curr_emb_for_dist = trajectory_embedding.clone().detach()
            goal_emb_for_dist = goal_embedding.clone().detach()

            current_distance = await main_loop.run_in_executor(
                None, lambda c=curr_emb_for_dist, g=goal_emb_for_dist: compute_distance(c, g)
            )

            # Calculate progress ratio (0 = no progress, 1 = reached goal)
            if initial_distance > 0.01:
                progress_ratio = max(0.0, 1.0 - (current_distance / initial_distance))
            else:
                progress_ratio = 1.0  # Already at goal

            # Record this step with progress tracking
            step_result = TrajectoryStep(
                step=step_idx,
                action=cem_result["action"],
                energy=cem_result["energy"],
                confidence=cem_result["confidence"],
                energy_history=cem_result["energy_history"],
                distance_to_goal=round(current_distance, 4),
                progress_ratio=round(progress_ratio, 4),
            )
            completed_steps.append(step_result)

            logger.info(
                f"[Trajectory] Step {step_idx + 1} complete: "
                f"action={step_result.action}, energy={step_result.energy:.3f}, "
                f"distance={current_distance:.4f}, progress={progress_ratio*100:.1f}%"
            )

            # Clear cache between steps to prevent memory buildup
            inference.clear_cache(aggressive=False)

        # Compute final distance after all steps
        # Capture embeddings to avoid closure issues
        final_traj_emb = trajectory_embedding.clone().detach()
        final_goal_emb = goal_embedding.clone().detach()
        final_distance = await main_loop.run_in_executor(
            None, lambda t=final_traj_emb, g=final_goal_emb: torch.abs(t - g).mean().item()
        )

        # Final cleanup
        inference.clear_cache(aggressive=True)
        del current_img
        del goal_img

        # Compute trajectory statistics
        total_energy = sum(s.energy for s in completed_steps)
        avg_energy = total_energy / len(completed_steps) if completed_steps else 0
        avg_confidence = sum(s.confidence for s in completed_steps) / len(completed_steps) if completed_steps else 0

        # Calculate total progress and energy trend
        total_progress = 1.0 - (final_distance / initial_distance) if initial_distance > 0.01 else 1.0

        # Determine energy trend based on overall progress
        # If we're making progress toward the goal (distance decreasing), that's what matters
        if len(completed_steps) >= 2:
            # Compare initial distance to final distance for trend
            # This reflects whether we're actually approaching the goal
            if final_distance < initial_distance * 0.95:  # Made at least 5% progress
                energy_trend = "decreasing"
            elif final_distance > initial_distance * 1.05:  # Got further away
                energy_trend = "increasing"
            else:
                energy_trend = "stable"  # Within 5% of initial
        else:
            energy_trend = "unknown"

        result = TrajectoryResult(
            steps=completed_steps,
            total_energy=round(total_energy, 3),
            avg_energy=round(avg_energy, 3),
            avg_confidence=round(avg_confidence, 3),
            is_ac_model=cem_result.get("is_ac_model", False) if completed_steps else False,
            # Progress tracking metrics
            initial_distance=round(initial_distance, 4),
            final_distance=round(final_distance, 4),
            total_progress=round(total_progress, 4),
            energy_trend=energy_trend,
        )

        task.result = result
        task.status = "completed"

        logger.info(
            f"[Trajectory] Planning completed: {len(completed_steps)} steps, "
            f"avg_energy={avg_energy:.3f}, progress={total_progress*100:.1f}%, "
            f"energy_trend={energy_trend}"
        )

        # Memory cleanup
        import gc

        gc.collect()
        if inference.device.type == "mps":
            torch.mps.synchronize()
            torch.mps.empty_cache()
        elif inference.device.type == "cuda":
            torch.cuda.empty_cache()

        self._cleanup_old_tasks()

        return result


# Singleton instance
planner = PlannerService()
