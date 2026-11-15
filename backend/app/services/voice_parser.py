import re
import time
import json
import base64
import logging
import httpx
import mimetypes
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from app.schemas import VoiceParseData, VoiceParseResponse
from app.config import settings

logger = logging.getLogger(__name__)

WEEKDAYS = {
    "monday": 0, "somwar": 0, "somvaar": 0,
    "tuesday": 1, "mangal": 1, "mangalwar": 1, "mangalvaar": 1,
    "wednesday": 2, "budh": 2, "budhwar": 2, "budhvaar": 2,
    "thursday": 3, "guru": 3, "guruwar": 3, "brihaspatiwar": 3, "guruvaar": 3,
    "friday": 4, "shukra": 4, "shukrawar": 4, "shukravaar": 4,
    "saturday": 5, "shani": 5, "shaniwar": 5, "shanivaar": 5,
    "sunday": 6, "ravi": 6, "raviwar": 6, "itwar": 6, "ravivaar": 6
}

def calculate_due_date(text: str) -> Optional[str]:
    """Calculate the due date from text mentions of weekdays, tomorrow, etc."""
    lowered = text.lower()
    today = datetime.now()

    if "tomorrow" in lowered or "kal" in lowered:
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")

    for day_name, day_idx in WEEKDAYS.items():
        if re.search(r'\b' + re.escape(day_name) + r'\b', lowered):
            # calculate days until next occurrence of day_idx
            days_ahead = day_idx - today.weekday()
            if days_ahead <= 0:  # Target day already happened this week or is today
                days_ahead += 7
            return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Check for direct date like 17/11, 2026-11-17
    match = re.search(r'\b(202\d[-/]\d{1,2}[-/]\d{1,2})\b', text)
    if match:
        return match.group(1).replace("/", "-")

    # Default to 7 days if udhari exists but no specific day mentioned
    return (today + timedelta(days=7)).strftime("%Y-%m-%d")

def extract_phone_number(text: str) -> Optional[str]:
    """Extract a 10-digit Indian phone number."""
    # Match 10 digits starting with 6, 7, 8, or 9, possibly separated by spaces or dashes
    cleaned = re.sub(r'[\s\-]', '', text)
    match = re.search(r'\b([6-9]\d{9})\b', cleaned)
    if match:
        return match.group(1)
    
    # Or in original text with word boundaries
    match2 = re.search(r'\b([6-9]\d{9})\b', text)
    if match2:
        return match2.group(1)
    return None

def extract_customer_name(text: str) -> Optional[str]:
    """Extract customer name from phrases like 'Ramesh 9876...', 'customer Ramesh', 'Ramesh ka 250'."""
    # Pattern: Name before phone number (e.g. Ramesh 9876543210)
    match = re.search(r'([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+[6-9]\d{9}', text)
    if match:
        name = match.group(1).strip()
        if name.lower() not in ["customer", "bill", "upi", "udhari", "cash", "total", "monday", "somwar"]:
            return name

    # Pattern: 'customer <Name>' or 'grahak <Name>'
    match2 = re.search(r'(?:customer|grahak|bhai|ji|name)\s+([A-Z][a-zA-Z]+|[a-zA-Z]+)', text, re.IGNORECASE)
    if match2:
        name = match2.group(1).capitalize()
        if name.lower() not in ["bill", "upi", "udhari", "cash", "total"]:
            return name

    # Pattern: '<Name> ka / ki / ke' e.g., 'Ramesh ka 250 udhari'
    match3 = re.search(r'([A-Za-z]+)\s+(?:ka|ki|ke)\s+(?:udhari|khata|bill|\d+|₹)', text, re.IGNORECASE)
    if match3:
        name = match3.group(1).capitalize()
        if name.lower() not in ["customer", "bill", "total", "aaj", "kal"]:
            return name

    # Pattern: Common Indian names
    known_names = [
        "Ramesh", "Suresh", "Mahesh", "Rajesh", "Priya", "Amit", "Rahul", "Vijay",
        "Anita", "Deepak", "Vikram", "Ganesh", "Kiran", "Sayandeep", "Sandeep", "Aman",
        "Rohan", "Pooja", "Neha", "Anil", "Sunil", "Kavita", "Ravi", "Manish"
    ]
    for kn in known_names:
        if re.search(r'\b' + re.escape(kn) + r'\b', text, re.IGNORECASE):
            return kn

    # Pattern: Name at start of sentence e.g. "Sayandeep 500", "Rahul bill 650"
    start_match = re.match(r'^\s*([A-Za-z]{3,20})\b', text)
    if start_match:
        cand = start_match.group(1).capitalize()
        excluded = [
            "customer", "bill", "total", "upi", "cash", "credit", "udhari", "rokkad",
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
            "somwar", "mangal", "budh", "guru", "shukra", "shani", "ravi", "kal", "aaj"
        ]
        if cand.lower() not in excluded:
            return cand

    # Pattern: Name after 'for' or at end e.g. 'credit for Monday, Rahul' or 'udhari to Sayandeep'
    end_match = re.search(r'(?:for|to|naam|name)?\s*([A-Z][a-zA-Z]{2,15})\s*$', text.strip())
    if end_match:
        cand2 = end_match.group(1).capitalize()
        excluded2 = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "today", "tomorrow"]
        if cand2.lower() not in excluded2:
            return cand2

    return None

def parse_voice_text(text: str) -> VoiceParseData:
    """Parse text into total, upi, udhari, cash, customer, phone, due date."""
    clean_text = text.replace("₹", " ₹ ").replace(",", " ")
    
    total_bill = 0.0
    upi_amount = 0.0
    udhari_amount = 0.0
    cash_amount = 0.0

    # 1. Look for explicit total amount
    # e.g., "Customer bill 650", "Total bill 650", "bill 650", "₹650 total", "₹1200 split"
    total_match = re.search(r'(?:total\s*bill|customer\s*bill|total|bill)\s*(?:of|is|hai)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_text, re.IGNORECASE)
    if total_match:
        total_bill = float(total_match.group(1))

    # Or "650 total" or "1200 split"
    if not total_bill:
        reverse_total = re.search(r'(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr)?\s*(?:total|bill|split)', clean_text, re.IGNORECASE)
        if reverse_total:
            total_bill = float(reverse_total.group(1))

    # Or sentence starting with an amount e.g. "₹1200 split with ₹500 cash"
    if not total_bill:
        start_amount = re.search(r'^\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_text, re.IGNORECASE)
        if start_amount:
            val = float(start_amount.group(1))
            # ensure it's not a phone number or tiny count
            if val > 50 and val < 100000000:
                total_bill = val

    # 2. Look for explicit UPI amount
    # e.g., "400 UPI", "₹400 UPI now", "₹200 Full UPI", "UPI 400", "400 upi se"
    upi_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupaye|rupees)?\s*(?:full|pure|now|abhi)?\s*upi', clean_text, re.IGNORECASE)
    if upi_match:
        upi_amount = float(upi_match.group(1))
    else:
        upi_match2 = re.search(r'upi\s*(?:full|now|abhi|se)?\s*(?:of|is|hai)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_text, re.IGNORECASE)
        if upi_match2:
            upi_amount = float(upi_match2.group(1))

    # 3. Look for explicit Udhari / Credit amount
    # e.g., "250 udhari", "₹250 udhari for Monday", "udhari 250", "baaki 250"
    udhari_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr)?\s*(?:udhari|credit|khata|baaki|baki)', clean_text, re.IGNORECASE)
    if udhari_match:
        udhari_amount = float(udhari_match.group(1))
    else:
        udhari_match2 = re.search(r'(?:udhari|credit|khata|baaki|baki)\s*(?:of|is|hai)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_text, re.IGNORECASE)
        if udhari_match2:
            udhari_amount = float(udhari_match2.group(1))

    # 4. Look for explicit Cash amount
    # e.g., "500 cash", "cash 500", "rokkad 500"
    cash_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr)?\s*(?:cash|rokkad)', clean_text, re.IGNORECASE)
    if cash_match:
        cash_amount = float(cash_match.group(1))
    else:
        cash_match2 = re.search(r'(?:cash|rokkad)\s*(?:of|is|hai)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)', clean_text, re.IGNORECASE)
        if cash_match2:
            cash_amount = float(cash_match2.group(1))

    # 5. Handle cases like "₹200 Full UPI" or "200 upi" where total wasn't explicitly tagged as "total"
    if total_bill == 0.0:
        if upi_amount > 0.0 and udhari_amount > 0.0:
            total_bill = upi_amount + udhari_amount + cash_amount
        elif upi_amount > 0.0 and "full" in clean_text.lower():
            total_bill = upi_amount
        elif upi_amount > 0.0 and udhari_amount == 0.0 and cash_amount == 0.0:
            total_bill = upi_amount
        elif udhari_amount > 0.0 and upi_amount == 0.0:
            total_bill = udhari_amount
        else:
            # Check for any standalone amount e.g. "Sayandeep 500", "Pooja 200"
            all_nums = re.findall(r'\b(\d+(?:\.\d+)?)\b', clean_text)
            for num_str in all_nums:
                if len(num_str) < 9:  # exclude phone numbers
                    val = float(num_str)
                    if val > 0:
                        total_bill = val
                        upi_amount = val
                        break

    # 6. Reconcile total with components if one is missing
    if total_bill > 0.0:
        if upi_amount == 0.0 and udhari_amount == 0.0 and cash_amount == 0.0:
            upi_amount = total_bill  # Default to full UPI
        elif upi_amount > 0.0 and udhari_amount == 0.0 and cash_amount > 0.0:
            if total_bill > (upi_amount + cash_amount):
                udhari_amount = round(total_bill - upi_amount - cash_amount, 2)
            elif total_bill == 0.0:
                total_bill = upi_amount + cash_amount
        elif upi_amount == 0.0 and cash_amount > 0.0 and total_bill > cash_amount:
            upi_amount = round(total_bill - cash_amount, 2)
        elif upi_amount > 0.0 and udhari_amount == 0.0 and (total_bill > upi_amount) and ("udhari" in clean_text.lower() or "baaki" in clean_text.lower()):
            udhari_amount = round(total_bill - upi_amount - cash_amount, 2)

    phone = extract_phone_number(text)
    name = extract_customer_name(text)
    
    due_date = None
    if udhari_amount > 0.0:
        due_date = calculate_due_date(text)

    # Detect items mentioned
    items = []
    item_keywords = ["oil", "rice", "salt", "atta", "dal", "sugar", "biscuit", "soap", "tea", "chai", "doodh", "milk"]
    for kw in item_keywords:
        if re.search(r'\b' + re.escape(kw) + r'\b', clean_text, re.IGNORECASE):
            items.append(kw.capitalize())

    return VoiceParseData(
        total_bill=round(total_bill, 2),
        upi_amount=round(upi_amount, 2),
        udhari_amount=round(udhari_amount, 2),
        cash_amount=round(cash_amount, 2),
        due_date=due_date,
        customer_name=name,
        customer_phone=phone,
        items=items
    )

async def parse_with_groq(text: str) -> Optional[VoiceParseData]:
    """Call Groq Llama-3.3-70B-versatile for high-accuracy Indic intent parsing."""
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        
        today_str = datetime.now().strftime("%Y-%m-%d (%A)")
        system_prompt = (
            f"You are a careful speech-to-checkout parser for an Indian kirana store.\n"
            f"Today's date is {today_str}.\n"
            f"The transcript may be Hindi, Hinglish, Tamil, Telugu, or English and may contain speech-recognition errors.\n"
            f"Extract only details supported by the transcript. Never invent a customer name, phone number, amount, item, or payment method.\n"
            f"Treat phone digits as a phone number, never as a bill amount. Amounts next to 'UPI' are upi_amount; amounts next to 'cash/rokkad' are cash_amount; amounts next to 'udhari/credit/khata/baaki' are udhari_amount.\n"
            f"Use an explicitly stated bill/total amount for total_bill. If it is omitted but payment parts are stated, total_bill is their sum. If a split is incomplete but the speaker explicitly says the remainder is udhari/credit, calculate the remainder from the total. Do not assume a remaining balance is credit without that cue.\n"
            f"Checkout default: if speech gives a customer and bill amount but no payment method, treat the full amount as UPI. If the speaker says pending/udhari/credit/khata/baaki and gives no split, treat the full amount as store credit. If they say cash but give no split, treat the full amount as cash.\n"
            f"Understand number words (for example, 'chhe sau pachaas' = 650, 'dhai sau' = 250). Resolve relative due dates from today's date.\n"
            f"Example: 'Rahul ka bill chhe sau pachaas, char sau UPI, dhai sau udhari somvaar ko' means Rahul, total 650, UPI 400, credit 250, due next Monday.\n"
            f"If a field is not stated or safely derivable, use 0 for amounts and null for text/date.\n"
            f"Output strictly valid JSON with these keys:\n"
            f'{{"total_bill": float, "upi_amount": float, "udhari_amount": float, "cash_amount": float, "due_date": string or null (format YYYY-MM-DD), "customer_name": string or null, "customer_phone": string or null (10-digit number), "items": list of strings}}'
        )
        
        completion = await client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=256,
            timeout=8.0
        )
        content = completion.choices[0].message.content
        if content:
            raw = json.loads(content)
            udhari = float(raw.get("udhari_amount") or 0.0)
            upi = float(raw.get("upi_amount") or 0.0)
            cash = float(raw.get("cash_amount") or 0.0)
            total = float(raw.get("total_bill") or 0.0)
            if min(total, upi, udhari, cash) < 0:
                raise ValueError("Parser returned a negative amount")
            data = VoiceParseData(
                total_bill=total,
                upi_amount=upi,
                udhari_amount=udhari,
                cash_amount=cash,
                due_date=raw.get("due_date") or (calculate_due_date(text) if udhari > 0 else None),
                customer_name=raw.get("customer_name") or extract_customer_name(text),
                customer_phone=raw.get("customer_phone") or extract_phone_number(text),
                items=raw.get("items") or []
            )
            if data.total_bill == 0.0 and (data.upi_amount > 0 or data.udhari_amount > 0):
                data.total_bill = round(data.upi_amount + data.udhari_amount + data.cash_amount, 2)
            if data.total_bill > 0 and data.upi_amount + data.udhari_amount + data.cash_amount == 0:
                lowered = text.lower()
                if re.search(r"\b(pending|udhari|credit|khata|baaki|baki)\b|उधार|बाकी", lowered):
                    data.udhari_amount = data.total_bill
                elif re.search(r"\b(cash|rokkad)\b|नकद|कैश", lowered):
                    data.cash_amount = data.total_bill
                else:
                    data.upi_amount = data.total_bill
            return data
    except Exception as e:
        logger.warning(f"Groq intent parsing failed or timed out ({e}), falling back to regex: {e}")
        return None

async def transcribe_with_sarvam(audio_bytes: bytes, filename: str = "recording.webm") -> Optional[str]:
    """Transcribe an utterance with Sarvam Saaras, detecting Hindi/Hinglish/English."""
    if not settings.SARVAM_API_KEY:
        return None
    try:
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={"api-subscription-key": settings.SARVAM_API_KEY},
                data={
                    "model": "saaras:v4",
                    "mode": "transcribe",
                    "language_code": "unknown",
                    "keyterms": json.dumps(["Paytm", "UPI", "udhari", "khata", "credit", "cash", "rupees"]),
                },
                files={"file": (filename, audio_bytes, mime_type)},
            )
        response.raise_for_status()
        transcript = response.json().get("transcript", "").strip()
        return transcript or None
    except Exception as e:
        logger.warning("Sarvam speech transcription failed (%s): %s", type(e).__name__, str(e)[:300])
        return None


async def transcribe_with_groq_whisper(audio_bytes: bytes, filename: str = "audio.webm") -> Optional[str]:
    """Transcribe real spoken audio into text using Groq Whisper-large-v3-turbo."""
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        transcription = await client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3-turbo",
            response_format="json"
        )
        result_text = transcription.text.strip() if hasattr(transcription, "text") else str(transcription).strip()
        return result_text
    except Exception as e:
        logger.error(f"Groq Whisper transcription error: {e}")
        return None

async def parse_voice_command(
    transcript_text: Optional[str] = None,
    audio_base64: Optional[str] = None,
    audio_bytes: Optional[bytes] = None,
    filename: str = "recording.webm",
    language: str = "hi"
) -> VoiceParseResponse:
    start_time = time.perf_counter()

    if audio_base64 and not audio_bytes:
        try:
            if "," in audio_base64:
                audio_base64 = audio_base64.split(",", 1)[1]
            audio_bytes = base64.b64decode(audio_base64)
        except Exception as e:
            logger.warning(f"Failed to decode audio base64: {e}")

    if audio_bytes and not transcript_text:
        transcript_text = await transcribe_with_sarvam(audio_bytes, filename=filename)
        if not transcript_text:
            transcript_text = await transcribe_with_groq_whisper(audio_bytes, filename=filename)

    text = (transcript_text or "").strip()
    data = None
    if settings.GROQ_API_KEY and text:
        data = await parse_with_groq(text)
    if not data and text:
        data = parse_voice_text(text)

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return VoiceParseResponse(
        success=True,
        transcript=text,
        latency_ms=duration_ms,
        data=data or VoiceParseData(
            total_bill=0.0,
            upi_amount=0.0,
            udhari_amount=0.0,
            cash_amount=0.0,
            due_date=None,
            customer_name=None,
            customer_phone=None,
            items=[]
        )
    )
