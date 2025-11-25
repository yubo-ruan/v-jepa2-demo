"""WebSocket connection manager for real-time updates."""

from typing import Dict, List
from fastapi import WebSocket
import json


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

    async def send_message(self, task_id: str, message: dict):
        """Send a message to all connections for a task."""
        if task_id in self.connections:
            disconnected = []
            for websocket in self.connections[task_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    disconnected.append(websocket)

            # Clean up disconnected sockets
            for ws in disconnected:
                self.disconnect(task_id, ws)

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
