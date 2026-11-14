import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings, STATIC_DIR
from app.database import init_db
from app.services.tts_service import prewarm_audio_cache
from app.routers import (
    voice,
    counter,
    webhook,
    udhari,
    restock,
    events,
    settings as settings_router
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database & pre-warm voice audio
    print(f"🚀 Initializing {settings.PROJECT_NAME} v{settings.VERSION}...")
    await init_db()
    prewarm_audio_cache()
    print("✓ Backend ready to serve requests.")
    yield
    # Shutdown
    print("👋 Shutting down backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous Voice-to-QR, Real-Time Webhook Spoof Guard, Partial Udhari & Snap-to-Restock Agent API",
    lifespan=lifespan
)

# CORS configuration for cross-origin frontend support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for audio announcements & invoices
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Mount API routers
app.include_router(voice.router, prefix=settings.API_PREFIX)
app.include_router(counter.router, prefix=settings.API_PREFIX)
app.include_router(webhook.router, prefix=settings.API_PREFIX)
app.include_router(udhari.router, prefix=settings.API_PREFIX)
app.include_router(restock.router, prefix=settings.API_PREFIX)
app.include_router(events.router, prefix=settings.API_PREFIX)
app.include_router(settings_router.router, prefix=settings.API_PREFIX)

@app.get("/health")
@app.get(f"{settings.API_PREFIX}/health")
async def health_check():
    """Health check endpoint verifying backend server operation."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "merchant": settings.DEFAULT_MERCHANT_NAME,
        "vpa": settings.DEFAULT_MERCHANT_VPA,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health": "/health",
        "api_endpoints": {
            "voice_parse": f"{settings.API_PREFIX}/voice/parse",
            "voice_tts": f"{settings.API_PREFIX}/voice/tts",
            "create_invoice": f"{settings.API_PREFIX}/counter/create-invoice",
            "active_invoice": f"{settings.API_PREFIX}/counter/active",
            "paytm_webhook": f"{settings.API_PREFIX}/paytm/webhook",
            "udhari_list": f"{settings.API_PREFIX}/udhari/list",
            "udhari_reminder": f"{settings.API_PREFIX}/udhari/send-reminder",
            "udhari_reconcile": f"{settings.API_PREFIX}/udhari/reconcile",
            "analyze_invoice": f"{settings.API_PREFIX}/restock/analyze-invoice",
            "send_po": f"{settings.API_PREFIX}/restock/send-po",
            "events_sse": f"{settings.API_PREFIX}/events",
            "settings": f"{settings.API_PREFIX}/settings"
        }
    }
