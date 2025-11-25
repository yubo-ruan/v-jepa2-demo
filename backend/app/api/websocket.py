"""WebSocket connection manager for real-time updates."""

import logging
from typing import Dict, List, Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections for task progress streaming."""

    def __init__(self):
        # task_id -> list of connected websockets
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, task_id: str, websocket: WebSocket):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        if task_id not in self.connections:
            self.connections[task_id] = []
        self.connections[task_id].append(websocket)

    def disconnect(self, task_id: str, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if task_id in self.connections:
            if websocket in self.connections[task_id]:
                self.connections[task_id].remove(websocket)
            if not self.connections[task_id]:
                del self.connections[task_id]

    async def send_message(self, task_id: str, message: Dict[str, Any]) -> int:
        """Send a message to all connections for a task.

        Returns the number of successful sends.
        """
        if task_id not in self.connections:
            return 0

        disconnected = []
        success_count = 0

        for websocket in self.connections[task_id]:
            try:
                await websocket.send_json(message)
                success_count += 1
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message for task {task_id}: {e}")
                disconnected.append(websocket)

        # Clean up disconnected sockets
        for ws in disconnected:
            self.disconnect(task_id, ws)

        return success_count

    async def broadcast_progress(self, task_id: str, progress: dict):
        """Broadcast progress update."""
        await self.send_message(task_id, {"type": "progress", "data": progress})

    async def broadcast_completed(self, task_id: str, result: dict):
        """Broadcast completion."""
        await self.send_message(task_id, {"type": "completed", "data": result})

    async def broadcast_error(self, task_id: str, error: str):
        """Broadcast error."""
        await self.send_message(task_id, {"type": "error", "data": {"message": error}})

    async def broadcast_cancelled(self, task_id: str):
        """Broadcast cancellation."""
        await self.send_message(task_id, {"type": "cancelled", "data": {}})


# Singleton instance
ws_manager = WebSocketManager()
