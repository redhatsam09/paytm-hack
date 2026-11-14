import json
import asyncio
from typing import Set, Dict, Any

class SSEBroadcaster:
    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        message = {
            "event": event_type,
            "data": data
        }
        # Push message to all active subscribers
        for queue in list(self.subscribers):
            try:
                await queue.put(message)
            except Exception:
                self.unsubscribe(queue)

sse_manager = SSEBroadcaster()
