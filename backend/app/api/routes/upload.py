"""Image upload API routes (dummy implementation)."""

import io
import logging
import uuid
import time
from typing import Dict, Any

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from PIL import Image

from app.models.schemas import UploadResponse
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# In-memory storage for dummy implementation
# Each entry has: content, content_type, filename, width, height, created_at
_uploads: Dict[str, Dict[str, Any]] = {}

# TTL for uploads in seconds (1 hour)
UPLOAD_TTL_SECONDS = 3600
# Max number of uploads to keep (to prevent unbounded growth)
MAX_UPLOADS = 100


def _cleanup_old_uploads():
    """Remove uploads older than TTL or if exceeding max count."""
    current_time = time.time()

    # Remove expired uploads
    expired_ids = [
        uid for uid, data in _uploads.items()
        if current_time - data.get("created_at", 0) > UPLOAD_TTL_SECONDS
    ]
    for uid in expired_ids:
        del _uploads[uid]
        logger.debug(f"Cleaned up expired upload: {uid}")

    # If still over limit, remove oldest
    if len(_uploads) > MAX_UPLOADS:
        sorted_uploads = sorted(
            _uploads.items(),
            key=lambda x: x[1].get("created_at", 0)
        )
        to_remove = len(_uploads) - MAX_UPLOADS
        for uid, _ in sorted_uploads[:to_remove]:
            del _uploads[uid]
            logger.debug(f"Cleaned up old upload (over limit): {uid}")


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

    # Cleanup old uploads before adding new one
    _cleanup_old_uploads()

    # Generate upload ID
    upload_id = str(uuid.uuid4())

    # Store in memory (dummy implementation)
    _uploads[upload_id] = {
        "content": content,
        "content_type": file.content_type,
        "filename": file.filename,
        "width": width,
        "height": height,
        "created_at": time.time(),
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
