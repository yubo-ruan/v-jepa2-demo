"""Image upload API routes (dummy implementation)."""

import uuid
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import io

from app.models.schemas import UploadResponse
from app.config import settings

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

    # Check file size (10MB max)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")

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
    from fastapi.responses import Response

    return Response(
        content=upload["content"],
        media_type=upload["content_type"],
    )
