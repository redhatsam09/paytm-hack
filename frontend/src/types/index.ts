export interface VoiceParseData {
  total_bill: number;
  upi_amount: number;
  udhari_amount: number;
  cash_amount: number;
  due_date?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: string[];
}

export interface VoiceParseResponse {
  success: boolean;
  transcript: string;
  latency_ms: number;
  data: VoiceParseData;
}

export interface InvoiceData {
  invoice_id: string;
  total_bill: number;
  upi_due: number;
  udhari_amount: number;
  cash_received: number;
  customer_name?: string;
  customer_phone?: string;
  due_date?: string;
  qr_data: string;
  qr_code_url: string;
  amount: number;
  expires_in: number;
  status: 'PENDING_PAYMENT' | 'COMPLETED' | 'SHORT_PAYMENT' | 'EXPIRED';
  udhari_id?: string;
  payment_mode?: 'DEMO' | 'PAYTM_DYNAMIC_QR' | 'CREDIT_ONLY';
}

export interface WebhookResponse {
  status: 'SUCCESS' | 'SHORTFALL_ALERT' | 'ERROR';
  alert_type: 'PAYMENT_SUCCESS' | 'SHORT_PAYMENT' | 'UNMATCHED';
  invoice_id?: string;
  amount_received: number;
  amount_expected: number;
  deficit: number;
  message: string;
  voice_alert: string;
  audio_base64?: string;
  audio_url?: string;
  whatsapp_action?: {
    type: string;
    customer_phone: string;
    message: string;
    payment_link: string;
  };
}

export interface UdhariItem {
  id: string;
  transaction_id?: string;
  customer_name: string;
  customer_phone: string;
  amount_due: number;
  due_date: string;
  status: 'UNPAID' | 'REMINDER_SENT' | 'SETTLED';
  paytm_payment_link: string;
  payment_link_id: string;
  created_at?: string;
  settled_at?: string;
}

export interface InvoiceItemParsed {
  sku: string;
  quantity: number;
  unit_rate: number;
  previous_rate?: number;
  price_hike_detected: boolean;
  hike_amount: number;
  hike_percentage: number;
  warning?: string;
}

export interface DraftPO {
  po_number: string;
  supplier_name: string;
  supplier_phone: string;
  items: Array<{
    sku: string;
    quantity: number;
    expected_rate: number;
  }>;
}

export interface InvoiceAnalysisResponse {
  success: boolean;
  vendor_name: string;
  invoice_no: string;
  invoice_date: string;
  items: InvoiceItemParsed[];
  price_hikes: InvoiceItemParsed[];
  draft_po: DraftPO;
  analysis_source?: 'LOCAL_FIXTURE' | 'GEMINI_VISION' | 'CSV_UPLOAD';
  validation_note?: string;
}

export interface RestockOrderResponse {
  success: boolean;
  message: string;
  po_number: string;
  status: string;
  whatsapp_preview: string;
}
