from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

# --- Voice & Intent Schemas ---

class VoiceParseRequest(BaseModel):
    audio_base64: Optional[str] = None
    transcript_text: Optional[str] = None
    language: str = "hi"

class VoiceParseData(BaseModel):
    total_bill: float
    upi_amount: float
    udhari_amount: float = 0.0
    cash_amount: float = 0.0
    due_date: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: Optional[List[str]] = Field(default_factory=list)

class VoiceParseResponse(BaseModel):
    success: bool
    transcript: str
    latency_ms: float
    data: VoiceParseData

# --- Counter & QR Schemas ---

class CreateInvoiceRequest(BaseModel):
    total_bill: float = Field(gt=0)
    upi_due: float = Field(gt=0)
    udhari_amount: float = Field(default=0.0, ge=0)
    cash_received: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    due_date: Optional[str] = None
    items_summary: Optional[str] = None

class InvoiceResponse(BaseModel):
    success: bool
    invoice_id: str
    total_bill: float
    upi_due: float
    udhari_amount: float = 0.0
    cash_received: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    due_date: Optional[str] = None
    qr_data: str
    qr_code_url: str
    amount: float
    expires_in: int = 180
    status: str
    udhari_id: Optional[str] = None
    payment_mode: str = "DEMO"

# --- Webhook & Spoof Guard Schemas ---

class WebhookPayload(BaseModel):
    merchant_vpa: str = "srilakshmi@paytm"
    utr: str
    amount: float = Field(gt=0)
    status: str = "SUCCESS"
    invoice_id: Optional[str] = None

class DemoFixtureRequest(BaseModel):
    invoice_id: str
    scenario: Literal["exact_match", "shortfall"]

class WebhookResponse(BaseModel):
    status: str  # SUCCESS, SHORTFALL_ALERT, ERROR
    alert_type: str  # PAYMENT_SUCCESS, SHORT_PAYMENT, UNMATCHED
    invoice_id: Optional[str] = None
    amount_received: float
    amount_expected: float
    deficit: float = 0.0
    message: str
    voice_alert: str
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
    whatsapp_action: Optional[Dict[str, Any]] = None

# --- Udhari Schemas ---

class UdhariItem(BaseModel):
    id: str
    transaction_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    amount_due: float
    due_date: str
    status: str
    paytm_payment_link: str
    payment_link_id: str
    created_at: Optional[str] = None
    settled_at: Optional[str] = None

class UdhariCreateRequest(BaseModel):
    customer_name: str
    customer_phone: str
    amount_due: float
    due_date: str
    transaction_id: Optional[str] = None

class UdhariReminderRequest(BaseModel):
    udhari_id: str

class UdhariReminderResponse(BaseModel):
    success: bool
    message: str
    whatsapp_payload: Dict[str, Any]

class UdhariReconcileRequest(BaseModel):
    udhari_id: str
    utr: str
    amount_paid: float = Field(gt=0)

class DemoUdhariFixtureRequest(BaseModel):
    udhari_id: str

class UdhariReconcileResponse(BaseModel):
    success: bool
    message: str
    settled_record: Optional[Dict[str, Any]] = None

# --- Restock & OCR Schemas ---

class InvoiceItemParsed(BaseModel):
    sku: str
    quantity: int
    unit_rate: float
    previous_rate: Optional[float] = None
    price_hike_detected: bool = False
    hike_amount: float = 0.0
    hike_percentage: float = 0.0
    warning: Optional[str] = None

class DraftPO(BaseModel):
    po_number: str
    supplier_name: str
    supplier_phone: str
    items: List[Dict[str, Any]]

class InvoiceAnalysisResponse(BaseModel):
    success: bool
    vendor_name: str
    invoice_no: str
    invoice_date: str
    items: List[InvoiceItemParsed]
    price_hikes: List[InvoiceItemParsed]
    draft_po: DraftPO
    analysis_source: Literal["LOCAL_FIXTURE", "GEMINI_VISION", "CSV_UPLOAD"] = "LOCAL_FIXTURE"
    validation_note: str = "Local fixture data; no external OCR or supplier API was used."

class SendPORequest(BaseModel):
    po_number: str
    supplier_name: str
    supplier_phone: str
    items: List[Dict[str, Any]]

class RestockOrderResponse(BaseModel):
    success: bool
    message: str
    po_number: str
    status: str
    whatsapp_preview: str

# --- TTS Schemas ---

class TTSRequest(BaseModel):
    text: str
    lang: str = "hi"
    alert_type: Optional[str] = None

class TTSResponse(BaseModel):
    audio_base64: str
    text: str
    content_type: str = "audio/mp3"
