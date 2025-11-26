"""System metrics and status API routes."""

from fastapi import APIRouter
from typing import List, Dict
from datetime import datetime
from pydantic import BaseModel

from app.services.metrics import dummy_metrics
from app.config import settings

router = APIRouter(prefix="/system", tags=["system"])


class GPUMetricsResponse(BaseModel):
    gpu_id: int
    name: str
    utilization_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    temperature_celsius: float
    power_watts: float


class SystemMetricsResponse(BaseModel):
    timestamp: datetime
    cpu_percent: float
    memory_used_gb: float
    memory_total_gb: float
    memory_percent: float
    disk_used_gb: float
    disk_total_gb: float
    disk_percent: float
    gpus: List[GPUMetricsResponse]


class MetricsHistoryResponse(BaseModel):
    history: List[Dict]
    interval_seconds: int


@router.get("/metrics", response_model=SystemMetricsResponse)
async def get_system_metrics():
    """Get current system metrics (CPU, memory, GPU)."""
    metrics = dummy_metrics.get_current_metrics()

    gpus = [
        GPUMetricsResponse(
            gpu_id=g.gpu_id,
            name=g.name,
            utilization_percent=g.utilization_percent,
            memory_used_mb=g.memory_used_mb,
            memory_total_mb=g.memory_total_mb,
            memory_percent=round(g.memory_used_mb / g.memory_total_mb * 100, 1),
            temperature_celsius=g.temperature_celsius,
            power_watts=g.power_watts,
        )
        for g in metrics.gpus
    ]

    return SystemMetricsResponse(
        timestamp=metrics.timestamp,
        cpu_percent=metrics.cpu_percent,
        memory_used_gb=metrics.memory_used_gb,
        memory_total_gb=metrics.memory_total_gb,
        memory_percent=round(metrics.memory_used_gb / metrics.memory_total_gb * 100, 1),
        disk_used_gb=metrics.disk_used_gb,
        disk_total_gb=metrics.disk_total_gb,
        disk_percent=round(metrics.disk_used_gb / metrics.disk_total_gb * 100, 1),
        gpus=gpus,
    )


@router.get("/metrics/history", response_model=MetricsHistoryResponse)
async def get_metrics_history(count: int = 60):
    """Get historical metrics for charts (last N data points)."""
    history = dummy_metrics.get_metrics_history(count)
    return MetricsHistoryResponse(
        history=history,
        interval_seconds=1,
    )


@router.get("/gpu/status")
async def get_gpu_status():
    """Get detailed GPU status."""
    metrics = dummy_metrics.get_current_metrics()
    gpu = metrics.gpus[0] if metrics.gpus else None

    if not gpu:
        return {"available": False}

    return {
        "available": True,
        "count": 1,
        "gpus": [
            {
                "id": gpu.gpu_id,
                "name": gpu.name,
                "driver_version": "545.23.08",
                "cuda_version": "12.3",
                "compute_capability": "8.9",
                "utilization": gpu.utilization_percent,
                "memory": {
                    "used_mb": gpu.memory_used_mb,
                    "total_mb": gpu.memory_total_mb,
                    "free_mb": gpu.memory_total_mb - gpu.memory_used_mb,
                },
                "temperature": gpu.temperature_celsius,
                "power": {
                    "current_watts": gpu.power_watts,
                    "limit_watts": 450,
                },
                "fan_speed_percent": min(100, 30 + gpu.temperature_celsius * 0.8),
            }
        ],
    }


@router.get("/device")
async def get_device_info():
    """
    Get compute device information for V-JEPA2 inference.

    Returns details about available hardware (MPS/CUDA/CPU)
    and recommendations for model selection.
    """
    # Import here to avoid circular imports and slow startup
    from app.services.vjepa2 import get_system_info
    return get_system_info()


@router.get("/config")
async def get_app_config():
    """Get current application configuration."""
    return {
        "default_model": settings.default_model,
        "default_samples": settings.default_samples,
        "default_iterations": settings.default_iterations,
        "use_fp16": settings.use_fp16,
        "max_batch_size": settings.max_batch_size,
    }
