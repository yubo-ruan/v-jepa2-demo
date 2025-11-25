"""Image upload API routes (dummy implementation)."""

import io
import logging
import uuid
from typing import Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from PIL import Image

from app.models.schemas import UploadResponse
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory storage for dummy implementation
_uploads: dict = {}


@router.post("", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """
    Upload an image for planning.

    Accepts JPG, PNG, WebP images up to 10MB.
    Returns an upload_id that can be used in planning requests.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}",
        )

    # Read file content
    content = await file.read()

    # Check file size
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.max_upload_size_mb}MB"
        )

    # Get image dimensions
    try:
        img = Image.open(io.BytesIO(content))
        width, height = img.size
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    # Generate upload ID
    upload_id = str(uuid.uuid4())

    # Store in memory (dummy implementation)
    _uploads[upload_id] = {
        "content": content,
        "content_type": file.content_type,
        "filename": file.filename,
        "width": width,
        "height": height,
    }

    return UploadResponse(
        upload_id=upload_id,
        url=f"/api/upload/{upload_id}",
        width=width,
        height=height,
    )


@router.get("/{upload_id}")
async def get_upload(upload_id: str):
    """Get an uploaded image by ID."""
    if upload_id not in _uploads:
        raise HTTPException(status_code=404, detail="Upload not found")

    upload = _uploads[upload_id]
    return Response(
        content=upload["content"],
        media_type=upload["content_type"],
    )
