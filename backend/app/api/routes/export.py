"""Export API routes for results and data."""

import json
import csv
import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.api.routes.experiments import _experiments

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    experiment_ids: List[str]
    format: str = "json"  # json, csv, numpy


@router.post("/experiments")
async def export_experiments(request: ExportRequest):
    """
    Export experiment data in various formats.

    Formats:
    - json: Full JSON export
    - csv: CSV spreadsheet format
    - numpy: NumPy-compatible format (actions as arrays)
    """
    # Get requested experiments
    experiments = []
    for exp_id in request.experiment_ids:
        if exp_id in _experiments:
            experiments.append(_experiments[exp_id])

    if not experiments:
        raise HTTPException(status_code=404, detail="No experiments found")

    if request.format == "json":
        data = {
            "exported_at": datetime.now().isoformat(),
            "count": len(experiments),
            "experiments": [exp.model_dump() for exp in experiments],
        }
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f"attachment; filename=experiments_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            },
        )

    elif request.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "id", "created_at", "title", "model", "confidence", "energy",
            "time_seconds", "samples", "iterations", "favorite",
            "action_x", "action_y", "action_z"
        ])

        # Data rows
        for exp in experiments:
            action = exp.action + [0] * (3 - len(exp.action))  # Pad to 3D
            writer.writerow([
                exp.id,
                exp.created_at.isoformat(),
                exp.title,
                exp.model,
                exp.confidence,
                exp.energy,
                exp.time_seconds,
                exp.samples,
                exp.iterations,
                exp.favorite,
                action[0],
                action[1],
                action[2],
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=experiments_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            },
        )

    elif request.format == "numpy":
        # Return JSON structure optimized for NumPy loading
        data = {
            "ids": [exp.id for exp in experiments],
            "actions": [exp.action for exp in experiments],
            "confidences": [exp.confidence for exp in experiments],
            "energies": [exp.energy for exp in experiments],
            "metadata": {
                "exported_at": datetime.now().isoformat(),
                "count": len(experiments),
                "action_dim": max(len(exp.action) for exp in experiments),
            },
        }
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f"attachment; filename=experiments_{datetime.now().strftime('%Y%m%d_%H%M%S')}_numpy.json"
            },
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unknown format: {request.format}")


@router.get("/experiment/{experiment_id}")
async def export_single_experiment(experiment_id: str, format: str = "json"):
    """Export a single experiment."""
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")

    exp = _experiments[experiment_id]

    if format == "json":
        return JSONResponse(content=exp.model_dump())

    # For other formats, reuse the batch export
    request = ExportRequest(experiment_ids=[experiment_id], format=format)
    return await export_experiments(request)


@router.get("/report/{experiment_id}")
async def generate_report(experiment_id: str):
    """
    Generate a detailed report for an experiment.

    Returns markdown-formatted report with all details.
    """
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")

    exp = _experiments[experiment_id]

    # Generate markdown report
    action_str = ", ".join([f"{a:.2f}" for a in exp.action])
    confidence_bar = "█" * int(exp.confidence * 10) + "░" * (10 - int(exp.confidence * 10))

    report = f"""# Experiment Report: {exp.title}

## Summary
- **ID:** {exp.id}
- **Created:** {exp.created_at.isoformat()}
- **Model:** {exp.model}
- **Status:** {"⭐ Favorite" if exp.favorite else "Standard"}

## Planning Parameters
| Parameter | Value |
|-----------|-------|
| Samples | {exp.samples} |
| Iterations | {exp.iterations} |
| Processing Time | {exp.time_seconds:.1f}s |

## Results

### Optimal Action
```
[{action_str}] (cm)
```

- **X:** {exp.action[0]:.2f} cm
- **Y:** {exp.action[1]:.2f} cm
- **Z:** {exp.action[2]:.2f} cm

### Metrics
| Metric | Value |
|--------|-------|
| Confidence | {exp.confidence:.1%} [{confidence_bar}] |
| Final Energy | {exp.energy:.3f} |

## Notes
This report was generated automatically by the V-JEPA2 Planning Demo.

---
*Generated at {datetime.now().isoformat()}*
"""

    return {
        "experiment_id": experiment_id,
        "format": "markdown",
        "content": report,
    }
