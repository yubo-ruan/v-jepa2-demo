"""Dummy model download service with progress simulation."""

import asyncio
import logging
import random
import uuid
from typing import Dict, Callable, Optional, Awaitable, Any
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class DownloadTask:
    """Represents a model download task."""
    id: str
    model_id: str
    model_name: str
    total_size_mb: float
    status: str = "queued"  # queued, downloading, completed, failed, cancelled
    downloaded_mb: float = 0
    speed_mbps: float = 0
    eta_seconds: float = 0
    cancelled: bool = False


class DummyDownloadService:
    """Simulates model download with realistic progress."""

    def __init__(self):
        self.tasks: Dict[str, DownloadTask] = {}
        # Track which models are "cached"
        self.cached_models: Dict[str, bool] = {
            "vit-giant": True,
            "vit-huge": False,
            "vit-large": False,
            "vit-giant-384": False,
        }
        self.model_sizes: Dict[str, float] = {
            "vit-giant": 7200,  # MB
            "vit-huge": 4500,
            "vit-large": 2100,
            "vit-giant-384": 7500,
        }

    def create_task(self, model_id: str, model_name: str) -> str:
        """Create a new download task."""
        task_id = str(uuid.uuid4())
        size = self.model_sizes.get(model_id, 5000)
        task = DownloadTask(
            id=task_id,
            model_id=model_id,
            model_name=model_name,
            total_size_mb=size,
        )
        self.tasks[task_id] = task
        return task_id

    def get_task(self, task_id: str) -> Optional[DownloadTask]:
        return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if task and task.status == "downloading":
            task.cancelled = True
            task.status = "cancelled"
            return True
        return False

    def is_cached(self, model_id: str) -> bool:
        return self.cached_models.get(model_id, False)

    async def run_download(
        self,
        task_id: str,
        progress_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> None:
        """Simulate download with realistic speed variations."""
        task = self.tasks.get(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        logger.info(f"Starting download for task {task_id}, model: {task.model_id}")
        task.status = "downloading"
        total = task.total_size_mb

        # Simulate varying download speeds (20-100 MB/s)
        base_speed = settings.dummy_download_speed_mbps

        while task.downloaded_mb < total:
            if task.cancelled:
                task.status = "cancelled"
                logger.info(f"Download cancelled for task {task_id}")
                return

            # Vary speed with some randomness
            speed = base_speed * random.uniform(0.4, 2.0)

            # Calculate chunk (simulate ~100ms update interval)
            chunk = speed * 0.1
            task.downloaded_mb = min(total, task.downloaded_mb + chunk)
            task.speed_mbps = round(speed, 1)

            remaining = total - task.downloaded_mb
            task.eta_seconds = round(remaining / speed, 1) if speed > 0 else 0

            if progress_callback:
                await progress_callback({
                    "downloaded_mb": round(task.downloaded_mb, 1),
                    "total_mb": total,
                    "speed_mbps": task.speed_mbps,
                    "eta_seconds": task.eta_seconds,
                    "percent": round((task.downloaded_mb / total) * 100, 1),
                })

            await asyncio.sleep(0.1)

        task.status = "completed"
        self.cached_models[task.model_id] = True
        logger.info(f"Download completed for task {task_id}, model: {task.model_id}")

        if progress_callback:
            await progress_callback({
                "downloaded_mb": total,
                "total_mb": total,
                "speed_mbps": 0,
                "eta_seconds": 0,
                "percent": 100,
                "completed": True,
            })


dummy_download = DummyDownloadService()
