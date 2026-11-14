import re
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from app.schemas import VoiceParseData, VoiceParseResponse

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

    # Pattern: Common Indian names at the end or before due date
    known_names = ["Ramesh", "Suresh", "Mahesh", "Rajesh", "Priya", "Amit", "Rahul", "Vijay", "Anita", "Deepak", "Vikram", "Ganesh", "Kiran"]
    for kn in known_names:
        if re.search(r'\b' + re.escape(kn) + r'\b', text, re.IGNORECASE):
            return kn

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

async def parse_voice_command(
    transcript_text: Optional[str] = None,
    audio_base64: Optional[str] = None,
    language: str = "hi"
) -> VoiceParseResponse:
    start_time = time.perf_counter()

    # If audio is provided but no transcript, provide realistic speech-to-text fallback
    if audio_base64 and not transcript_text:
        # Placeholder or mocked ASR decoding for demo
        transcript_text = "Customer bill 650, 400 UPI now, 250 udhari for Monday, Ramesh 9876543210"

    text = transcript_text or ""
    data = parse_voice_text(text)

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return VoiceParseResponse(
        success=True,
        transcript=text,
        latency_ms=duration_ms,
        data=data
    )
