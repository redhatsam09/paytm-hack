from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from app.schemas import VoiceParseRequest, VoiceParseResponse, TTSRequest, TTSResponse
from app.services.voice_parser import parse_voice_command
from app.services.tts_service import synthesize_speech, AUDIO_DIR

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
