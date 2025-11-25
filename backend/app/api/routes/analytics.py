"""Analytics API for usage statistics and performance metrics."""

import logging
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


class UsageMetric(BaseModel):
    """Single usage metric data point."""
    timestamp: datetime
    value: float
    label: Optional[str] = None


class UsageSummary(BaseModel):
    """Usage summary statistics."""
    total_plans: int
    total_experiments: int
    total_comparisons: int
    total_trajectories: int
    total_videos_processed: int
    avg_planning_time_seconds: float
    avg_confidence: float
    avg_energy: float
    models_used: Dict[str, int]
    presets_used: Dict[str, int]


class PerformanceMetrics(BaseModel):
    """Model performance metrics."""
    model_id: str
    model_name: str
    total_inferences: int
    avg_inference_time_ms: float
    avg_energy: float
    avg_confidence: float
    success_rate: float
    p50_inference_ms: float
    p95_inference_ms: float
    p99_inference_ms: float


class TimeSeriesPoint(BaseModel):
    """Time series data point."""
    timestamp: datetime
    value: float


def _generate_usage_data(days: int = 30) -> List[Dict]:
    """Generate simulated usage data for the past N days."""
    data = []
    base_date = datetime.now() - timedelta(days=days)

    for i in range(days):
        date = base_date + timedelta(days=i)
        # Simulate daily usage with some patterns
        is_weekend = date.weekday() >= 5
        base_plans = 50 if not is_weekend else 20

        data.append({
            "date": date.strftime("%Y-%m-%d"),
            "plans": base_plans + random.randint(-10, 30),
            "experiments": random.randint(5, 25),
            "comparisons": random.randint(2, 15),
            "trajectories": random.randint(1, 10),
            "videos": random.randint(0, 5),
            "api_calls": base_plans * 3 + random.randint(0, 100),
        })

    return data


def _generate_hourly_data(hours: int = 24) -> List[Dict]:
    """Generate hourly usage data."""
    data = []
    base_time = datetime.now() - timedelta(hours=hours)

    for i in range(hours):
        time = base_time + timedelta(hours=i)
        hour = time.hour

        # Simulate hourly patterns (peak during work hours)
        if 9 <= hour <= 17:
            base = 30
        elif 7 <= hour <= 9 or 17 <= hour <= 20:
            base = 15
        else:
            base = 5

        data.append({
            "timestamp": time.isoformat(),
            "hour": hour,
            "api_calls": base + random.randint(-3, 10),
            "active_users": max(1, base // 3 + random.randint(-2, 5)),
            "avg_response_ms": 150 + random.randint(-50, 100),
        })

    return data


@router.get("/usage/summary", response_model=UsageSummary)
async def get_usage_summary(days: int = Query(default=30, ge=1, le=365)):
    """Get usage summary for the specified period."""
    # Simulate aggregated usage data
    total_plans = sum(random.randint(20, 80) for _ in range(days))
    total_experiments = int(total_plans * 0.3)

    return UsageSummary(
        total_plans=total_plans,
        total_experiments=total_experiments,
        total_comparisons=int(total_plans * 0.15),
        total_trajectories=int(total_plans * 0.08),
        total_videos_processed=int(total_plans * 0.05),
        avg_planning_time_seconds=round(random.uniform(2.0, 5.0), 2),
        avg_confidence=round(random.uniform(0.75, 0.92), 3),
        avg_energy=round(random.uniform(1.2, 2.8), 3),
        models_used={
            "vit-giant": int(total_plans * 0.45),
            "vit-huge": int(total_plans * 0.35),
            "vit-large": int(total_plans * 0.15),
            "vit-giant-384": int(total_plans * 0.05),
        },
        presets_used={
            "quick": int(total_plans * 0.2),
            "balanced": int(total_plans * 0.4),
            "quality": int(total_plans * 0.25),
            "research": int(total_plans * 0.1),
            "custom": int(total_plans * 0.05),
        },
    )


@router.get("/usage/daily")
async def get_daily_usage(days: int = Query(default=30, ge=1, le=90)):
    """Get daily usage statistics."""
    return {
        "period_days": days,
        "data": _generate_usage_data(days),
    }


@router.get("/usage/hourly")
async def get_hourly_usage(hours: int = Query(default=24, ge=1, le=168)):
    """Get hourly usage for the specified period."""
    return {
        "period_hours": hours,
        "data": _generate_hourly_data(hours),
    }


@router.get("/performance/models", response_model=List[PerformanceMetrics])
async def get_model_performance():
    """Get performance metrics for all models."""
    models = [
        ("vit-giant", "ViT-Giant", 120),
        ("vit-huge", "ViT-Huge", 80),
        ("vit-large", "ViT-Large", 50),
        ("vit-giant-384", "ViT-Giant 384", 150),
    ]

    metrics = []
    for model_id, model_name, base_inference in models:
        total_inferences = random.randint(500, 2000)

        metrics.append(PerformanceMetrics(
            model_id=model_id,
            model_name=model_name,
            total_inferences=total_inferences,
            avg_inference_time_ms=round(base_inference * random.uniform(0.9, 1.1), 1),
            avg_energy=round(random.uniform(1.0, 3.0), 3),
            avg_confidence=round(random.uniform(0.75, 0.95), 3),
            success_rate=round(random.uniform(0.95, 0.995), 3),
            p50_inference_ms=round(base_inference * 0.9, 1),
            p95_inference_ms=round(base_inference * 1.5, 1),
            p99_inference_ms=round(base_inference * 2.0, 1),
        ))

    return metrics


@router.get("/performance/latency")
async def get_latency_distribution(
    model_id: Optional[str] = None,
    hours: int = Query(default=24, ge=1, le=168)
):
    """Get latency distribution over time."""
    base_latency = {
        "vit-giant": 120,
        "vit-huge": 80,
        "vit-large": 50,
        "vit-giant-384": 150,
    }.get(model_id, 100)

    # Generate latency time series
    data = []
    base_time = datetime.now() - timedelta(hours=hours)

    for i in range(hours * 4):  # 15-minute intervals
        time = base_time + timedelta(minutes=i * 15)
        latency = base_latency * random.uniform(0.7, 1.5)
        data.append({
            "timestamp": time.isoformat(),
            "p50": round(latency * 0.8, 1),
            "p95": round(latency * 1.3, 1),
            "p99": round(latency * 1.8, 1),
            "max": round(latency * 2.5, 1),
        })

    return {
        "model_id": model_id or "all",
        "period_hours": hours,
        "data": data,
    }


@router.get("/performance/errors")
async def get_error_statistics(days: int = Query(default=7, ge=1, le=30)):
    """Get error statistics."""
    error_types = [
        ("timeout", "Task timeout exceeded"),
        ("memory", "GPU out of memory"),
        ("invalid_input", "Invalid input image"),
        ("model_load", "Failed to load model"),
        ("network", "Network connection error"),
    ]

    errors = []
    for error_type, description in error_types:
        count = random.randint(0, 20)
        if count > 0:
            errors.append({
                "error_type": error_type,
                "description": description,
                "count": count,
                "last_occurrence": (datetime.now() - timedelta(hours=random.randint(1, 48))).isoformat(),
            })

    total_requests = sum(random.randint(20, 80) for _ in range(days)) * 3
    total_errors = sum(e["count"] for e in errors)

    return {
        "period_days": days,
        "total_requests": total_requests,
        "total_errors": total_errors,
        "error_rate": round(total_errors / total_requests * 100, 3) if total_requests > 0 else 0,
        "errors": sorted(errors, key=lambda e: -e["count"]),
    }


@router.get("/trends")
async def get_usage_trends(metric: str = "plans", days: int = Query(default=30, ge=7, le=90)):
    """Get usage trends with moving averages."""
    daily_data = _generate_usage_data(days)

    # Calculate 7-day moving average
    values = [d.get(metric, d.get("plans", 0)) for d in daily_data]

    trends = []
    for i, d in enumerate(daily_data):
        window_start = max(0, i - 6)
        window = values[window_start:i + 1]
        ma7 = sum(window) / len(window)

        trends.append({
            "date": d["date"],
            "value": values[i],
            "ma7": round(ma7, 1),
        })

    # Calculate growth
    if len(values) >= 14:
        recent_avg = sum(values[-7:]) / 7
        previous_avg = sum(values[-14:-7]) / 7
        growth = ((recent_avg - previous_avg) / previous_avg * 100) if previous_avg > 0 else 0
    else:
        growth = 0

    return {
        "metric": metric,
        "period_days": days,
        "data": trends,
        "current_avg": round(sum(values[-7:]) / min(7, len(values)), 1),
        "growth_percent": round(growth, 1),
    }


@router.get("/export")
async def export_analytics(
    format: str = Query(default="json", regex="^(json|csv)$"),
    days: int = Query(default=30, ge=1, le=90)
):
    """Export analytics data."""
    data = _generate_usage_data(days)

    if format == "csv":
        from fastapi.responses import Response

        headers = ["date", "plans", "experiments", "comparisons", "trajectories", "videos", "api_calls"]
        csv_lines = [",".join(headers)]
        for row in data:
            csv_lines.append(",".join(str(row.get(h, "")) for h in headers))

        return Response(
            content="\n".join(csv_lines),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analytics_{days}d.csv"},
        )

    return {
        "exported_at": datetime.now().isoformat(),
        "period_days": days,
        "data": data,
    }
