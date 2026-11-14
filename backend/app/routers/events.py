import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.sse_manager import sse_manager

router = APIRouter(tags=["Real-time Push Events"])

@router.get("/events")
async def event_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint for real-time dual-screen synchronization.
    Stream events: INVOICE_CREATED, PAYMENT_SUCCESS, SHORTFALL_ALERT, COUNTER_RESET, etc.
    """
    async def event_generator():
        queue = await sse_manager.subscribe()
        try:
            # Send initial connected handshake
            yield f"event: connected\ndata: {json.dumps({'status': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for message with timeout to send keepalive
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    event_name = message.get("event", "message")
                    data_str = json.dumps(message.get("data", {}))
                    yield f"event: {event_name}\ndata: {data_str}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield ": keepalive\n\n"
        finally:
            sse_manager.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
