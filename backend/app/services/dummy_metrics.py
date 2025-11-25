"""Dummy system metrics service."""

import random
import time
from typing import Dict, List
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class GPUMetrics:
    """GPU utilization metrics."""
    gpu_id: int
    name: str
    utilization_percent: float
    memory_used_mb: float
    memory_total_mb: float
    temperature_celsius: float
    power_watts: float


@dataclass
class SystemMetrics:
    """Overall system metrics."""
    timestamp: datetime
    cpu_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disk_used_gb: float
    disk_total_gb: float
    gpus: List[GPUMetrics]


class DummyMetricsService:
    """Simulates system metrics with realistic variations."""

    def __init__(self):
        self._base_gpu_util = 0
        self._is_processing = False
        self._history: List[SystemMetrics] = []

    def set_processing(self, is_processing: bool):
        """Update processing state to affect GPU metrics."""
        self._is_processing = is_processing
        self._base_gpu_util = 85 if is_processing else 5

    def get_current_metrics(self) -> SystemMetrics:
        """Get current system metrics with realistic variations."""
        # CPU varies between 10-30% normally, 40-70% when processing
        base_cpu = 50 if self._is_processing else 15
        cpu = base_cpu + random.uniform(-10, 15)

        # Memory
        memory_total = 64.0  # GB
        base_memory = 24.0 if self._is_processing else 12.0
        memory_used = base_memory + random.uniform(-2, 4)

        # Disk
        disk_total = 1000.0  # GB
        disk_used = 450 + random.uniform(-5, 5)

        # GPU metrics
        gpu_util = self._base_gpu_util + random.uniform(-5, 10)
        gpu_util = max(0, min(100, gpu_util))

        gpu_memory_total = 24576  # 24GB VRAM
        base_gpu_memory = 18000 if self._is_processing else 2000
        gpu_memory_used = base_gpu_memory + random.uniform(-500, 1000)

        # Temperature correlates with utilization
        base_temp = 35 + (gpu_util * 0.4)
        gpu_temp = base_temp + random.uniform(-3, 5)

        # Power correlates with utilization
        base_power = 50 + (gpu_util * 2.5)
        gpu_power = base_power + random.uniform(-10, 15)

        gpu = GPUMetrics(
            gpu_id=0,
            name="NVIDIA RTX 4090",
            utilization_percent=round(gpu_util, 1),
            memory_used_mb=round(gpu_memory_used, 0),
            memory_total_mb=gpu_memory_total,
            temperature_celsius=round(gpu_temp, 1),
            power_watts=round(gpu_power, 1),
        )

        metrics = SystemMetrics(
            timestamp=datetime.now(),
            cpu_percent=round(cpu, 1),
            memory_used_gb=round(memory_used, 2),
            memory_total_gb=memory_total,
            disk_used_gb=round(disk_used, 1),
            disk_total_gb=disk_total,
            gpus=[gpu],
        )

        # Keep last 100 entries in history
        self._history.append(metrics)
        if len(self._history) > 100:
            self._history.pop(0)

        return metrics

    def get_metrics_history(self, count: int = 60) -> List[Dict]:
        """Get recent metrics history for charts."""
        # Generate fake history if we don't have enough
        if len(self._history) < count:
            history = []
            for i in range(count):
                t = time.time() - (count - i)
                # Simulate some variation
                gpu_util = 10 + random.uniform(0, 20) + (30 if i > count * 0.7 else 0)
                history.append({
                    "timestamp": datetime.fromtimestamp(t).isoformat(),
                    "gpu_utilization": round(gpu_util, 1),
                    "gpu_memory_percent": round(10 + random.uniform(0, 15), 1),
                    "cpu_percent": round(15 + random.uniform(0, 10), 1),
                })
            return history

        return [
            {
                "timestamp": m.timestamp.isoformat(),
                "gpu_utilization": m.gpus[0].utilization_percent if m.gpus else 0,
                "gpu_memory_percent": round(
                    (m.gpus[0].memory_used_mb / m.gpus[0].memory_total_mb * 100) if m.gpus else 0, 1
                ),
                "cpu_percent": m.cpu_percent,
            }
            for m in self._history[-count:]
        ]


dummy_metrics = DummyMetricsService()
