import json
import secrets
import time
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect

class WebSocketConnectionManager:
    def __init__(self):
        # Map user_id -> Set of active WebSocket instances
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Map ticket -> {"user_id": int, "expires_at": float}
        self.tickets: Dict[str, Dict[str, Any]] = {}

    def generate_ticket(self, user_id: int, expires_in_seconds: int = 60) -> str:
        """Generate a cryptographically secure, single-use, short-lived WebSocket ticket."""
        self._cleanup_expired_tickets()
        ticket = f"wst_{secrets.token_urlsafe(32)}"
        self.tickets[ticket] = {
            "user_id": user_id,
            "expires_at": time.time() + expires_in_seconds
        }
        return ticket

    def validate_and_consume_ticket(self, ticket: str) -> Optional[int]:
        """Validate ticket, ensure it is not expired, and consume it (single-use)."""
        self._cleanup_expired_tickets()
        if not ticket or ticket not in self.tickets:
            return None
        data = self.tickets.pop(ticket)
        if time.time() > data["expires_at"]:
            return None
        return data["user_id"]

    def _cleanup_expired_tickets(self):
        now = time.time()
        expired = [t for t, data in self.tickets.items() if now > data["expires_at"]]
        for t in expired:
            self.tickets.pop(t, None)

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: Dict[str, Any]):
        """Send live JSON message only to authenticated user's active WebSocket sessions."""
        if user_id not in self.active_connections:
            return

        payload = json.dumps(message)
        dead_connections = set()
        
        for ws in self.active_connections[user_id]:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_connections.add(ws)

        # Cleanup any dead sockets
        for ws in dead_connections:
            self.active_connections[user_id].discard(ws)
        if user_id in self.active_connections and not self.active_connections[user_id]:
            del self.active_connections[user_id]

# Singleton instance
ws_manager = WebSocketConnectionManager()
