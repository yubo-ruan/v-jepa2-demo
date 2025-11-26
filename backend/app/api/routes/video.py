"""Video processing API routes with simulated frame extraction."""

import asyncio
import base64
import io
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.api.websocket import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["video"])

# TTL for video data in seconds (30 minutes)
VIDEO_TTL_SECONDS = 1800
# Max number of videos to keep (to prevent unbounded growth)
MAX_VIDEOS = 50
# Max number of frames to keep
MAX_FRAMES = 500


class VideoInfo(BaseModel):
    """Video upload information."""
    video_id: str
    filename: str
    duration_seconds: float
    fps: float
    width: int
    height: int
    frame_count: int
    uploaded_at: datetime


class FrameExtractionRequest(BaseModel):
    """Request to extract frames from video."""
    video_id: str
    strategy: str = "uniform"  # uniform, keyframes, interval
    num_frames: int = 10
    interval_seconds: Optional[float] = None


class ExtractedFrame(BaseModel):
    """Extracted video frame."""
    frame_id: str
    frame_number: int
    timestamp_seconds: float
    thumbnail_url: str


class ExtractionTask(BaseModel):
    """Frame extraction task status."""
    task_id: str
    video_id: str
    status: str  # queued, processing, completed, failed
    progress_percent: float = 0
    frames: List[ExtractedFrame] = []
    error: Optional[str] = None


# In-memory storage
_videos: Dict[str, VideoInfo] = {}
_extractions: Dict[str, ExtractionTask] = {}
_frame_data: Dict[str, bytes] = {}  # frame_id -> image bytes
_frame_created_at: Dict[str, float] = {}  # frame_id -> timestamp for cleanup


def _cleanup_old_data():
    """Remove videos and frames older than TTL or if exceeding max count."""
    current_time = time.time()

    # Remove expired videos and their associated frames/extractions
    expired_video_ids = [
        vid for vid, info in _videos.items()
        if (current_time - info.uploaded_at.timestamp()) > VIDEO_TTL_SECONDS
    ]
    for vid in expired_video_ids:
        _delete_video_data(vid)
        logger.debug(f"Cleaned up expired video: {vid}")

    # If still over limit, remove oldest videos
    if len(_videos) > MAX_VIDEOS:
        sorted_videos = sorted(
            _videos.items(),
            key=lambda x: x[1].uploaded_at.timestamp()
        )
        to_remove = len(_videos) - MAX_VIDEOS
        for vid, _ in sorted_videos[:to_remove]:
            _delete_video_data(vid)
            logger.debug(f"Cleaned up old video (over limit): {vid}")

    # Clean up orphaned frames (not associated with any extraction)
    if len(_frame_data) > MAX_FRAMES:
        # Get all frame IDs from active extractions
        active_frame_ids = set()
        for task in _extractions.values():
            for frame in task.frames:
                active_frame_ids.add(frame.frame_id)

        # Find orphaned frames
        orphaned = [fid for fid in _frame_data.keys() if fid not in active_frame_ids]
        # Sort by creation time and remove oldest
        orphaned_sorted = sorted(
            orphaned,
            key=lambda fid: _frame_created_at.get(fid, 0)
        )
        to_remove = len(_frame_data) - MAX_FRAMES
        for fid in orphaned_sorted[:to_remove]:
            _frame_data.pop(fid, None)
            _frame_created_at.pop(fid, None)
            logger.debug(f"Cleaned up orphaned frame: {fid}")


def _delete_video_data(video_id: str):
    """Delete a video and all associated extractions and frames."""
    # Clean up related extractions and frames
    for task_id, task in list(_extractions.items()):
        if task.video_id == video_id:
            for frame in task.frames:
                _frame_data.pop(frame.frame_id, None)
                _frame_created_at.pop(frame.frame_id, None)
            del _extractions[task_id]

    _videos.pop(video_id, None)


# Simulated video data for demo
def _generate_dummy_video_info(filename: str) -> VideoInfo:
    """Generate realistic video metadata."""
    import random

    video_id = str(uuid.uuid4())
    duration = random.uniform(5.0, 120.0)
    fps = random.choice([24.0, 25.0, 29.97, 30.0, 60.0])

    return VideoInfo(
        video_id=video_id,
        filename=filename,
        duration_seconds=round(duration, 2),
        fps=fps,
        width=random.choice([1280, 1920, 3840]),
        height=random.choice([720, 1080, 2160]),
        frame_count=int(duration * fps),
        uploaded_at=datetime.now(),
    )


def _generate_dummy_frame(frame_num: int, width: int = 224, height: int = 224) -> bytes:
    """Generate a dummy frame image (colored rectangle)."""
    from PIL import Image
    import random

    # Create a gradient image with some variation
    img = Image.new('RGB', (width, height))
    pixels = img.load()

    base_r = (frame_num * 17) % 256
    base_g = (frame_num * 31) % 256
    base_b = (frame_num * 47) % 256

    for y in range(height):
        for x in range(width):
            r = (base_r + x // 3) % 256
            g = (base_g + y // 3) % 256
            b = (base_b + (x + y) // 4) % 256
            pixels[x, y] = (r, g, b)

    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()


@router.post("/upload", response_model=VideoInfo)
async def upload_video(file: UploadFile = File(...)):
    """
    Upload a video file for frame extraction.

    Accepts MP4, AVI, MOV, WebM videos up to 100MB.
    Returns video metadata and ID for further processing.
    """
    allowed_types = ["video/mp4", "video/avi", "video/quicktime", "video/webm", "video/x-msvideo"]

    # For demo, accept any file and simulate
    content = await file.read()

    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Video too large. Max size: 100MB")

    # Cleanup old data before adding new
    _cleanup_old_data()

    # Generate simulated video info
    video_info = _generate_dummy_video_info(file.filename or "video.mp4")
    _videos[video_info.video_id] = video_info

    logger.info(f"Video uploaded: {video_info.video_id}, {video_info.filename}")

    return video_info


@router.get("/{video_id}", response_model=VideoInfo)
async def get_video(video_id: str):
    """Get video information by ID."""
    if video_id not in _videos:
        raise HTTPException(status_code=404, detail="Video not found")
    return _videos[video_id]


@router.get("")
async def list_videos(limit: int = 20):
    """List uploaded videos."""
    videos = sorted(
        _videos.values(),
        key=lambda v: v.uploaded_at,
        reverse=True
    )[:limit]

    return {
        "videos": [v.model_dump() for v in videos],
        "total": len(_videos),
    }


@router.post("/extract", response_model=ExtractionTask)
async def extract_frames(request: FrameExtractionRequest):
    """
    Start frame extraction from a video.

    Strategies:
    - uniform: Extract evenly spaced frames
    - keyframes: Extract scene change frames (simulated)
    - interval: Extract at fixed time intervals
    """
    if request.video_id not in _videos:
        raise HTTPException(status_code=404, detail="Video not found")

    video = _videos[request.video_id]

    task_id = str(uuid.uuid4())
    task = ExtractionTask(
        task_id=task_id,
        video_id=request.video_id,
        status="queued",
    )
    _extractions[task_id] = task

    # Start extraction in background
    asyncio.create_task(_run_extraction(task_id, video, request))

    return task


async def _run_extraction(task_id: str, video: VideoInfo, request: FrameExtractionRequest):
    """Run frame extraction with progress updates."""
    import random

    task = _extractions.get(task_id)
    if not task:
        return

    task.status = "processing"
    num_frames = min(request.num_frames, video.frame_count)

    # Calculate frame timestamps based on strategy
    if request.strategy == "interval" and request.interval_seconds:
        timestamps = []
        t = 0.0
        while t < video.duration_seconds and len(timestamps) < num_frames:
            timestamps.append(t)
            t += request.interval_seconds
    elif request.strategy == "keyframes":
        # Simulate keyframe detection (random but sensible positions)
        timestamps = sorted([random.uniform(0, video.duration_seconds) for _ in range(num_frames)])
    else:  # uniform
        step = video.duration_seconds / (num_frames + 1)
        timestamps = [step * (i + 1) for i in range(num_frames)]

    for i, timestamp in enumerate(timestamps):
        # Simulate processing time
        await asyncio.sleep(0.2)

        frame_num = int(timestamp * video.fps)
        frame_id = str(uuid.uuid4())

        # Generate dummy frame
        frame_bytes = _generate_dummy_frame(frame_num)
        _frame_data[frame_id] = frame_bytes
        _frame_created_at[frame_id] = time.time()

        frame = ExtractedFrame(
            frame_id=frame_id,
            frame_number=frame_num,
            timestamp_seconds=round(timestamp, 3),
            thumbnail_url=f"/api/video/frame/{frame_id}",
        )
        task.frames.append(frame)
        task.progress_percent = ((i + 1) / num_frames) * 100

        # Broadcast progress
        await ws_manager.send_message(task_id, {
            "type": "progress",
            "data": {
                "progress_percent": task.progress_percent,
                "frames_extracted": len(task.frames),
                "total_frames": num_frames,
            },
        })

    task.status = "completed"
    logger.info(f"Frame extraction completed: {task_id}, {len(task.frames)} frames")

    await ws_manager.send_message(task_id, {
        "type": "completed",
        "data": {"frames": [f.model_dump() for f in task.frames]},
    })


@router.get("/extract/{task_id}", response_model=ExtractionTask)
async def get_extraction_status(task_id: str):
    """Get frame extraction task status."""
    if task_id not in _extractions:
        raise HTTPException(status_code=404, detail="Extraction task not found")
    return _extractions[task_id]


@router.get("/frame/{frame_id}")
async def get_frame(frame_id: str):
    """Get extracted frame image."""
    from fastapi.responses import Response

    if frame_id not in _frame_data:
        raise HTTPException(status_code=404, detail="Frame not found")

    return Response(
        content=_frame_data[frame_id],
        media_type="image/jpeg",
    )


@router.delete("/{video_id}")
async def delete_video(video_id: str):
    """Delete a video and its extracted frames."""
    if video_id not in _videos:
        raise HTTPException(status_code=404, detail="Video not found")

    _delete_video_data(video_id)

    return {"status": "deleted", "video_id": video_id}
