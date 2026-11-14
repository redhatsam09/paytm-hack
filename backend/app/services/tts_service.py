import os
import io
import base64
import hashlib
from pathlib import Path
from typing import Optional, Tuple
from gtts import gTTS
from app.config import AUDIO_DIR

# Ensure audio directory exists
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Audio cache in memory
_AUDIO_CACHE = {}

def get_text_hash(text: str, lang: str) -> str:
    return hashlib.md5(f"{lang}:{text}".encode("utf-8")).hexdigest()

def synthesize_speech(text: str, lang: str = "hi") -> Tuple[str, str]:
    """
    Synthesize speech using gTTS with disk and in-memory caching.
    Returns (audio_base64, audio_url).
    """
    cache_key = get_text_hash(text, lang)
    file_path = AUDIO_DIR / f"{cache_key}.mp3"
    relative_url = f"/static/audio/{cache_key}.mp3"

    if cache_key in _AUDIO_CACHE:
        return _AUDIO_CACHE[cache_key], relative_url

    if file_path.exists():
        with open(file_path, "rb") as f:
            audio_bytes = f.read()
        b64 = base64.b64encode(audio_bytes).decode("utf-8")
        _AUDIO_CACHE[cache_key] = b64
        return b64, relative_url

    try:
        # Convert Hindi/English numerals for natural speech in Hindi
        speech_text = text
        # Convert common symbols like ₹ to rupaye
        speech_text = speech_text.replace("₹", "")
        if "rupaye" not in speech_text.lower() and "prapt" in speech_text:
            speech_text = speech_text.replace("prapt", "rupaye prapt")

        tts = gTTS(text=speech_text, lang=lang if lang in ["hi", "en", "ta", "te"] else "hi")
        tts.save(str(file_path))

        with open(file_path, "rb") as f:
            audio_bytes = f.read()

        b64 = base64.b64encode(audio_bytes).decode("utf-8")
        _AUDIO_CACHE[cache_key] = b64
        return b64, relative_url
    except Exception as e:
        # Fallback dummy audio or empty base64 if network is unavailable
        print(f"Warning: TTS synthesis error: {e}")
        return "", ""

def get_payment_success_audio(amount: float) -> Tuple[str, str, str]:
    """
    Returns (voice_alert_text, audio_base64, audio_url)
    e.g. 'Paytm par ₹400 prapt hue'
    """
    display_amount = int(amount) if amount.is_integer() else amount
    text = f"Paytm par ₹{display_amount} prapt hue"
    # For speech pronunciation
    speech_text = f"Paytm par {display_amount} rupaye prapt hue"
    b64, url = synthesize_speech(speech_text, lang="hi")
    return text, b64, url

def get_shortfall_warning_audio(paid: float, deficit: float) -> Tuple[str, str, str]:
    """
    Returns (voice_warning_text, audio_base64, audio_url)
    e.g. 'Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!'
    """
    paid_int = int(paid) if paid.is_integer() else paid
    deficit_int = int(deficit) if deficit.is_integer() else deficit
    text = f"Savdhaan! Keval ₹{paid_int} prapt hue hain! ₹{deficit_int} baaki hai!"
    speech_text = f"Savdhaan! Keval {paid_int} rupaye prapt hue hain! {deficit_int} rupaye baaki hai!"
    b64, url = synthesize_speech(speech_text, lang="hi")
    return text, b64, url

def prewarm_audio_cache():
    """Pre-generate canonical soundbox audio files during application startup."""
    try:
        # Flow 1 & 2 Canonical Alerts
        get_payment_success_audio(400.0)
        get_shortfall_warning_audio(40.0, 360.0)
        get_payment_success_audio(250.0)
        get_payment_success_audio(650.0)
        print("✓ Soundbox TTS cache pre-warmed successfully.")
    except Exception as e:
        print(f"! Notice: Soundbox audio pre-warm had non-fatal warning: {e}")
