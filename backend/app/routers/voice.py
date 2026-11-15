from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional
from app.schemas import VoiceParseRequest, VoiceParseResponse, TTSRequest, TTSResponse
from app.services.voice_parser import parse_voice_command
from app.services.tts_service import synthesize_speech, AUDIO_DIR
from app.config import settings

router = APIRouter(prefix="/voice", tags=["Voice & Intent"])

@router.post("/parse", response_model=VoiceParseResponse)
async def parse_voice(request: VoiceParseRequest):
    """
    Parse natural voice transcript or audio into structured Paytm checkout entities:
    total bill, upi due, udhari split, customer name, phone, due date.
    Maintains ultra-low latency (<600ms).
    """
    return await parse_voice_command(
        transcript_text=request.transcript_text,
        audio_base64=request.audio_base64,
        language=request.language
    )

@router.post("/transcribe-audio", response_model=VoiceParseResponse)
async def transcribe_audio_endpoint(
    file: UploadFile = File(...),
    language: str = Form("hi")
):
    """
    Accepts a short microphone recording, transcribes with Sarvam Saaras when
    configured (Groq Whisper fallback), then parses checkout entities.
    """
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="The microphone recording was empty. Please record again.")
    if not settings.SARVAM_API_KEY and not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Configure SARVAM_API_KEY or GROQ_API_KEY to transcribe microphone audio.")
    filename = file.filename or "recording.webm"
    result = await parse_voice_command(
        audio_bytes=audio_bytes,
        filename=filename,
        language=language
    )
    if not result.transcript.strip():
        raise HTTPException(status_code=502, detail="Speech transcription failed. Try again or enter the bill by typing.")
    return result

@router.post("/tts", response_model=TTSResponse)
async def generate_tts(request: TTSRequest):
    """
    Synthesize audio announcement for Soundbox hardware.
    """
    b64, url = synthesize_speech(request.text, lang=request.lang)
    return TTSResponse(
        audio_base64=b64,
        text=request.text,
        content_type="audio/mp3"
    )

@router.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve pre-generated or cached Soundbox voice audio file."""
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path=str(file_path), media_type="audio/mp3")
