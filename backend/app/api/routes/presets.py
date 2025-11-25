"""Presets/Templates API for saving planning configurations."""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/presets", tags=["presets"])


class PresetConfig(BaseModel):
    """Planning configuration preset."""
    model: str = "vit-giant"
    samples: int = Field(default=400, ge=10, le=2000)
    iterations: int = Field(default=10, ge=1, le=100)
    elite_fraction: float = Field(default=0.1, ge=0.01, le=0.5)
    planning_horizon: int = Field(default=1, ge=1, le=20)


class Preset(BaseModel):
    """Saved preset with metadata."""
    preset_id: str
    name: str
    description: Optional[str] = None
    config: PresetConfig
    category: str = "custom"  # quick, balanced, quality, custom
    is_default: bool = False
    is_favorite: bool = False
    use_count: int = 0
    created_at: datetime
    updated_at: datetime


class CreatePresetRequest(BaseModel):
    """Request to create a new preset."""
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    config: PresetConfig
    category: str = "custom"


class UpdatePresetRequest(BaseModel):
    """Request to update a preset."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    config: Optional[PresetConfig] = None
    is_favorite: Optional[bool] = None


# Default presets
DEFAULT_PRESETS: Dict[str, Preset] = {
    "quick": Preset(
        preset_id="quick",
        name="Quick",
        description="Fast inference for prototyping (low quality)",
        config=PresetConfig(model="vit-large", samples=100, iterations=5),
        category="quick",
        is_default=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    ),
    "balanced": Preset(
        preset_id="balanced",
        name="Balanced",
        description="Good balance of speed and quality",
        config=PresetConfig(model="vit-huge", samples=300, iterations=10),
        category="balanced",
        is_default=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    ),
    "quality": Preset(
        preset_id="quality",
        name="High Quality",
        description="Best quality, slower inference",
        config=PresetConfig(model="vit-giant", samples=500, iterations=15),
        category="quality",
        is_default=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    ),
    "research": Preset(
        preset_id="research",
        name="Research",
        description="Maximum samples for research experiments",
        config=PresetConfig(model="vit-giant", samples=1000, iterations=20, elite_fraction=0.05),
        category="quality",
        is_default=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    ),
    "trajectory": Preset(
        preset_id="trajectory",
        name="Multi-Step Trajectory",
        description="Optimized for trajectory planning",
        config=PresetConfig(model="vit-giant", samples=200, iterations=8, planning_horizon=10),
        category="balanced",
        is_default=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    ),
}

# Custom presets storage
_custom_presets: Dict[str, Preset] = {}


@router.get("", response_model=List[Preset])
async def list_presets(category: Optional[str] = None, favorites_only: bool = False):
    """List all presets, optionally filtered by category."""
    all_presets = list(DEFAULT_PRESETS.values()) + list(_custom_presets.values())

    if category:
        all_presets = [p for p in all_presets if p.category == category]

    if favorites_only:
        all_presets = [p for p in all_presets if p.is_favorite]

    # Sort: favorites first, then by use count
    all_presets.sort(key=lambda p: (-p.is_favorite, -p.use_count, p.name))

    return all_presets


@router.get("/{preset_id}", response_model=Preset)
async def get_preset(preset_id: str):
    """Get a specific preset by ID."""
    if preset_id in DEFAULT_PRESETS:
        return DEFAULT_PRESETS[preset_id]
    if preset_id in _custom_presets:
        return _custom_presets[preset_id]
    raise HTTPException(status_code=404, detail="Preset not found")


@router.post("", response_model=Preset)
async def create_preset(request: CreatePresetRequest):
    """Create a new custom preset."""
    # Check for duplicate names
    existing_names = {p.name.lower() for p in DEFAULT_PRESETS.values()}
    existing_names.update(p.name.lower() for p in _custom_presets.values())

    if request.name.lower() in existing_names:
        raise HTTPException(status_code=400, detail="Preset with this name already exists")

    preset_id = str(uuid.uuid4())
    now = datetime.now()

    preset = Preset(
        preset_id=preset_id,
        name=request.name,
        description=request.description,
        config=request.config,
        category=request.category,
        is_default=False,
        created_at=now,
        updated_at=now,
    )

    _custom_presets[preset_id] = preset
    logger.info(f"Created preset: {preset_id}, {request.name}")

    return preset


@router.patch("/{preset_id}", response_model=Preset)
async def update_preset(preset_id: str, request: UpdatePresetRequest):
    """Update a preset (only custom presets can be modified)."""
    if preset_id in DEFAULT_PRESETS:
        # Allow only favorite toggle for default presets
        if request.is_favorite is not None:
            DEFAULT_PRESETS[preset_id].is_favorite = request.is_favorite
            DEFAULT_PRESETS[preset_id].updated_at = datetime.now()
            return DEFAULT_PRESETS[preset_id]
        raise HTTPException(status_code=400, detail="Cannot modify default presets")

    if preset_id not in _custom_presets:
        raise HTTPException(status_code=404, detail="Preset not found")

    preset = _custom_presets[preset_id]

    if request.name is not None:
        preset.name = request.name
    if request.description is not None:
        preset.description = request.description
    if request.config is not None:
        preset.config = request.config
    if request.is_favorite is not None:
        preset.is_favorite = request.is_favorite

    preset.updated_at = datetime.now()

    return preset


@router.delete("/{preset_id}")
async def delete_preset(preset_id: str):
    """Delete a custom preset."""
    if preset_id in DEFAULT_PRESETS:
        raise HTTPException(status_code=400, detail="Cannot delete default presets")

    if preset_id not in _custom_presets:
        raise HTTPException(status_code=404, detail="Preset not found")

    del _custom_presets[preset_id]
    logger.info(f"Deleted preset: {preset_id}")

    return {"status": "deleted", "preset_id": preset_id}


@router.post("/{preset_id}/use")
async def use_preset(preset_id: str):
    """Record that a preset was used (increments use count)."""
    preset = None

    if preset_id in DEFAULT_PRESETS:
        preset = DEFAULT_PRESETS[preset_id]
    elif preset_id in _custom_presets:
        preset = _custom_presets[preset_id]
    else:
        raise HTTPException(status_code=404, detail="Preset not found")

    preset.use_count += 1
    preset.updated_at = datetime.now()

    return {
        "preset_id": preset_id,
        "use_count": preset.use_count,
        "config": preset.config.model_dump(),
    }


@router.post("/{preset_id}/duplicate", response_model=Preset)
async def duplicate_preset(preset_id: str, new_name: str):
    """Duplicate a preset with a new name."""
    source = None

    if preset_id in DEFAULT_PRESETS:
        source = DEFAULT_PRESETS[preset_id]
    elif preset_id in _custom_presets:
        source = _custom_presets[preset_id]
    else:
        raise HTTPException(status_code=404, detail="Preset not found")

    # Check for duplicate names
    existing_names = {p.name.lower() for p in DEFAULT_PRESETS.values()}
    existing_names.update(p.name.lower() for p in _custom_presets.values())

    if new_name.lower() in existing_names:
        raise HTTPException(status_code=400, detail="Preset with this name already exists")

    new_preset_id = str(uuid.uuid4())
    now = datetime.now()

    new_preset = Preset(
        preset_id=new_preset_id,
        name=new_name,
        description=f"Copy of {source.name}",
        config=source.config.model_copy(),
        category="custom",
        is_default=False,
        created_at=now,
        updated_at=now,
    )

    _custom_presets[new_preset_id] = new_preset
    logger.info(f"Duplicated preset {preset_id} as {new_preset_id}")

    return new_preset


@router.get("/categories/list")
async def list_categories():
    """List available preset categories."""
    return {
        "categories": [
            {"id": "quick", "name": "Quick", "description": "Fast inference presets"},
            {"id": "balanced", "name": "Balanced", "description": "Balance of speed and quality"},
            {"id": "quality", "name": "High Quality", "description": "Best quality presets"},
            {"id": "custom", "name": "Custom", "description": "User-created presets"},
        ]
    }
