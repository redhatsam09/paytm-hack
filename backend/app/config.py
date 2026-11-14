import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
AUDIO_DIR = STATIC_DIR / "audio"
DB_PATH = BASE_DIR / "paytm_merchant.db"

class Settings(BaseModel):
    PROJECT_NAME: str = "Paytm Soundbox Autonomous Merchant Agent API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{DB_PATH}")
    
    # Merchant Default Details
    DEFAULT_MERCHANT_NAME: str = "Sri Lakshmi Stores"
    DEFAULT_MERCHANT_VPA: str = "srilakshmi@paytm"
    DEFAULT_MERCHANT_PHONE: str = "+919876543210"
    DEFAULT_LANGUAGE: str = "hi"
    
    # API Keys (optional, fallback to mock/local)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    SARVAM_API_KEY: str = os.getenv("SARVAM_API_KEY", "")
    WHATSAPP_API_TOKEN: str = os.getenv("WHATSAPP_API_TOKEN", "")
    PAYTM_WEBHOOK_SECRET: str = os.getenv("PAYTM_WEBHOOK_SECRET", "")
    
    # QR Code config
    QR_EXPIRY_SECONDS: int = 180

settings = Settings()
