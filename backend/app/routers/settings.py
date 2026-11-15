from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models import Merchant
from app.config import paytm_live_ready

router = APIRouter(prefix="/settings", tags=["API & System Settings"])

class SettingsUpdateRequest(BaseModel):
    sarvam_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    whatsapp_api_token: Optional[str] = None
    paytm_webhook_secret: Optional[str] = None
    merchant_vpa: Optional[str] = None
    merchant_name: Optional[str] = None
    default_language: Optional[str] = None

def mask_key(key: Optional[str]) -> str:
    if not key:
        return ""
    cleaned = key.strip()
    if len(cleaned) <= 6:
        return "******"
    return f"{cleaned[:3]}...{cleaned[-4:]}"

@router.get("")
async def get_settings_status(db: AsyncSession = Depends(get_db)):
    """
    Get current configuration status, runtime key presence (masked),
    and active engine mode (Zero-Setup Mock vs Live APIs).
    """
    stmt = select(Merchant)
    res = await db.execute(stmt)
    merchant = res.scalars().first()

    has_live_keys = bool(
        settings.SARVAM_API_KEY
        or settings.GROQ_API_KEY
        or settings.GEMINI_API_KEY
        or settings.WHATSAPP_API_TOKEN
    )

    return {
        "status": "success",
        "payment_integration": {
            "mode": "PAYTM_DYNAMIC_QR" if paytm_live_ready() else "DEMO_ONLY",
            "environment": settings.PAYTM_ENV,
            "merchant_configured": paytm_live_ready(),
            "webhook_url": settings.PAYTM_PUBLIC_WEBHOOK_URL or None,
        },
        "engine_mode": "LIVE_API" if has_live_keys else "ZERO_SETUP_MOCK",
        "mode_description": (
            "Active with Live AI/API integrations"
            if has_live_keys
            else "🟢 Active in Zero-Setup Mock Engine (Ready for hackathon judging out of the box, enter keys to switch to live APIs)"
        ),
        "keys": {
            "sarvam_api_key": {
                "is_configured": bool(settings.SARVAM_API_KEY),
                "masked": mask_key(settings.SARVAM_API_KEY)
            },
            "groq_api_key": {
                "is_configured": bool(settings.GROQ_API_KEY),
                "masked": mask_key(settings.GROQ_API_KEY)
            },
            "gemini_api_key": {
                "is_configured": bool(settings.GEMINI_API_KEY),
                "masked": mask_key(settings.GEMINI_API_KEY)
            },
            "whatsapp_api_token": {
                "is_configured": bool(settings.WHATSAPP_API_TOKEN),
                "masked": mask_key(settings.WHATSAPP_API_TOKEN)
            },
            "paytm_webhook_secret": {
                "is_configured": bool(settings.PAYTM_WEBHOOK_SECRET),
                "masked": mask_key(settings.PAYTM_WEBHOOK_SECRET)
            }
        },
        "merchant": {
            "vpa": merchant.vpa if merchant else settings.DEFAULT_MERCHANT_VPA,
            "store_name": merchant.store_name if merchant else settings.DEFAULT_MERCHANT_NAME,
            "phone": merchant.phone if merchant else settings.DEFAULT_MERCHANT_PHONE,
            "default_language": merchant.default_language if merchant else settings.DEFAULT_LANGUAGE
        },
        "supported_languages": [
            {"code": "hi", "name": "Hindi (हिंदी)"},
            {"code": "en", "name": "English"},
            {"code": "ta", "name": "Tamil (தமிழ்)"},
            {"code": "te", "name": "Telugu (తెలుగు)"}
        ]
    }

@router.post("")
async def update_settings(update: SettingsUpdateRequest, db: AsyncSession = Depends(get_db)):
    """
    Update runtime API keys and merchant preferences dynamically.
    """
    if update.sarvam_api_key is not None:
        settings.SARVAM_API_KEY = update.sarvam_api_key.strip()
    if update.groq_api_key is not None:
        settings.GROQ_API_KEY = update.groq_api_key.strip()
    if update.gemini_api_key is not None:
        settings.GEMINI_API_KEY = update.gemini_api_key.strip()
    if update.whatsapp_api_token is not None:
        settings.WHATSAPP_API_TOKEN = update.whatsapp_api_token.strip()
    if update.paytm_webhook_secret is not None:
        settings.PAYTM_WEBHOOK_SECRET = update.paytm_webhook_secret.strip()

    stmt = select(Merchant)
    res = await db.execute(stmt)
    merchant = res.scalars().first()

    if update.merchant_vpa:
        settings.DEFAULT_MERCHANT_VPA = update.merchant_vpa.strip()
        if merchant:
            merchant.vpa = update.merchant_vpa.strip()

    if update.merchant_name:
        settings.DEFAULT_MERCHANT_NAME = update.merchant_name.strip()
        if merchant:
            merchant.store_name = update.merchant_name.strip()

    if update.default_language:
        settings.DEFAULT_LANGUAGE = update.default_language.strip()
        if merchant:
            merchant.default_language = update.default_language.strip()

    await db.commit()

    return {
        "success": True,
        "message": "Settings updated successfully",
        "updated_keys": {
            "sarvam_configured": bool(settings.SARVAM_API_KEY),
            "groq_configured": bool(settings.GROQ_API_KEY),
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "whatsapp_configured": bool(settings.WHATSAPP_API_TOKEN),
            "merchant_vpa": settings.DEFAULT_MERCHANT_VPA,
            "merchant_name": settings.DEFAULT_MERCHANT_NAME
        }
    }
