import {
  VoiceParseResponse,
  InvoiceData,
  WebhookResponse,
  UdhariItem,
  InvoiceAnalysisResponse,
  RestockOrderResponse,
} from '@/types';

const API_BASE = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000');

// In-memory mock store for offline / fallback demonstration
const mockState = {
  activeInvoice: null as InvoiceData | null,
  udhariList: [
    {
      id: 'udh-001',
      transaction_id: 'INV-2026-001',
      customer_name: 'Ramesh Kumar',
      customer_phone: '9876543210',
      amount_due: 250,
      due_date: '2026-11-17',
      status: 'UNPAID' as const,
      paytm_payment_link: 'https://p.paytm.me/pay?id=udh-001&am=250.00',
      payment_link_id: 'PLINK-9821',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'udh-002',
      transaction_id: 'INV-2026-000',
      customer_name: 'Suresh Verma',
      customer_phone: '9811223344',
      amount_due: 350,
      due_date: '2026-11-20',
      status: 'REMINDER_SENT' as const,
      paytm_payment_link: 'https://p.paytm.me/pay?id=udh-002&am=350.00',
      payment_link_id: 'PLINK-7734',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'udh-003',
      transaction_id: 'INV-2026-OLD',
      customer_name: 'Anita Sharma',
      customer_phone: '9988776655',
      amount_due: 180,
      due_date: '2026-11-10',
      status: 'SETTLED' as const,
      paytm_payment_link: 'https://p.paytm.me/pay?id=udh-003&am=180.00',
      payment_link_id: 'PLINK-5512',
      created_at: new Date(Date.now() - 172800000).toISOString(),
      settled_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ] as UdhariItem[],
};

// Subscribe to real-time Server-Sent Events (SSE)
export function subscribeToEvents(onEvent: (event: { event_type: string; data?: unknown }) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`${API_BASE}/api/events`);
    const deliver = (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent({ event_type: e.type === 'message' ? parsed.event_type || parsed.event : e.type, data: parsed.data || parsed });
      } catch (err) {
        console.warn('Failed to parse SSE event data', err);
      }
    };
    eventSource.onmessage = deliver;
    ['PAYMENT_SUCCESS', 'SHORTFALL_ALERT', 'INVOICE_CREATED', 'COUNTER_RESET'].forEach((eventName) => {
      eventSource?.addEventListener(eventName, deliver as EventListener);
    });
    eventSource.onerror = () => {
      // Cleanly handled by browser reconnection
    };
  } catch (err) {
    console.warn('SSE connection failed', err);
  }

  return () => {
    if (eventSource) {
      eventSource.close();
    }
  };
}

// 1. Voice Intent Parsing
export async function transcribeAudioRecording(audioBlob: Blob, lang = 'hi'): Promise<VoiceParseResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('language', lang);

  const res = await fetch(`${API_BASE}/api/voice/transcribe-audio`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Audio transcription failed');
  }

  return await res.json();
}

export async function parseVoiceCommand(transcript: string, lang = 'hi'): Promise<VoiceParseResponse> {
  const startTime = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/voice/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript_text: transcript, language: lang }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend unreachable, proceed with mock parser
  }

  // Fallback regex & intent extraction
  const lower = transcript.toLowerCase();
  let total_bill = 0;
  let upi_amount = 0;
  let udhari_amount = 0;
  let cash_amount = 0;
  let customer_name: string | undefined;
  let customer_phone: string | undefined;
  let due_date: string | undefined;

  const phoneMatch = transcript.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) customer_phone = phoneMatch[0];

  const excludedNames = new Set(['customer', 'grahak', 'bill', 'total', 'upi', 'online', 'cash', 'credit', 'udhari', 'khata', 'baaki', 'for', 'to', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
  const nameBeforePhone = transcript.match(/\b([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})\s+[6-9]\d{9}\b/);
  const namedPhrase = transcript.match(/\b(?:customer|grahak|name|for|to)\s+(?:is\s+)?([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)?)/i);
  const atStart = transcript.match(/^\s*([A-Za-z][A-Za-z'-]*)\s+(?=(?:bill|total|upi|credit|udhari|khata)\b)/i);
  for (const rawCandidate of [nameBeforePhone?.[1], namedPhrase?.[1], atStart?.[1]]) {
    const candidateWords = (rawCandidate || '').trim().split(/\s+/).filter((word) => word && !excludedNames.has(word.toLowerCase()));
    if (candidateWords.length) {
      customer_name = candidateWords.join(' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
      break;
    }
  }

  const billMatch = transcript.match(/(?:bill|total|for)?\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (billMatch) total_bill = parseFloat(billMatch[1]);

  const upiMatch = transcript.match(/(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:upi|online)/i) ||
                   transcript.match(/(?:upi|online)\s*(?:of|is|now)?\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (upiMatch) upi_amount = parseFloat(upiMatch[1]);

  const udhariMatch = transcript.match(/(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:udhari|credit|baaki|khata)/i) ||
                       transcript.match(/(?:udhari|credit|baaki)\s*(?:of|is|for)?\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (udhariMatch) udhari_amount = parseFloat(udhariMatch[1]);

  const cashMatch = transcript.match(/(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:cash|nagad)/i);
  if (cashMatch) cash_amount = parseFloat(cashMatch[1]);

  if (total_bill > 0 && upi_amount === 0 && udhari_amount === 0 && cash_amount === 0) {
    upi_amount = total_bill;
  } else if (total_bill > 0 && upi_amount > 0 && udhari_amount === 0 && cash_amount === 0) {
    if (total_bill > upi_amount) {
      udhari_amount = total_bill - upi_amount;
    }
  } else if (total_bill === 0 && (upi_amount > 0 || udhari_amount > 0)) {
    total_bill = upi_amount + udhari_amount + cash_amount;
  }

  const weekdayTokens = [
    ['sunday', 'itwar', 'raviwar'],
    ['monday', 'somwar', 'somvaar'],
    ['tuesday', 'mangalwar', 'mangalvaar'],
    ['wednesday', 'budhwar', 'budhvaar'],
    ['thursday', 'guruwar', 'guruvaar'],
    ['friday', 'shukrawar', 'shukravaar'],
    ['saturday', 'shaniwar', 'shanivaar'],
  ];
  const weekday = weekdayTokens.findIndex((tokens) => tokens.some((day) => lower.includes(day)));
  const due = new Date();
  if (lower.includes('tomorrow') || lower.includes('kal')) due.setDate(due.getDate() + 1);
  else if (weekday >= 0) {
    const daysAhead = (weekday - due.getDay() + 7) % 7 || 7;
    due.setDate(due.getDate() + daysAhead);
  } else if (udhari_amount > 0) due.setDate(due.getDate() + 7);
  if (udhari_amount > 0) due_date = due.toISOString().slice(0, 10);

  const latency_ms = Math.round(performance.now() - startTime + 8);

  return {
    success: true,
    transcript,
    latency_ms,
    data: {
      total_bill,
      upi_amount,
      udhari_amount,
      cash_amount,
      due_date,
      customer_name,
      customer_phone,
      items: [],
    },
  };
}

// 2. Create Dynamic Amount-Locked Invoice
export async function createCounterInvoice(payload: {
  total_bill: number;
  upi_due: number;
  udhari_amount: number;
  cash_received?: number;
  customer_name?: string;
  customer_phone?: string;
  due_date?: string;
}): Promise<InvoiceData> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/counter/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? `Counter service unavailable: ${error.message}` : 'Counter service unavailable');
  }
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || 'Could not create payment invoice');
  const invoice = await response.json();
  mockState.activeInvoice = invoice;
  return invoice;
}

// 3. Deterministic local gateway fixture (never represented as real money).
export async function replayDemoPaymentFixture(payload: {
  invoice_id: string;
  scenario: 'exact_match' | 'shortfall';
}): Promise<WebhookResponse> {
  const response = await fetch(`${API_BASE}/api/paytm/demo-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || 'Demo fixture rejected');
  return await response.json();
}

// Compatibility for the two older, currently unmounted workflow components.
// Their amount only selects a fixed test scenario; it is never sent as evidence.
export async function triggerPaytmWebhook(payload: {
  utr: string;
  amount: number;
  invoice_id?: string;
  merchant_vpa?: string;
}): Promise<WebhookResponse> {
  const invoice = mockState.activeInvoice;
  const invoiceId = payload.invoice_id || invoice?.invoice_id;
  if (!invoiceId) throw new Error('Create an invoice before running a payment fixture');
  const expected = invoice?.upi_due ?? 400;
  return replayDemoPaymentFixture({
    invoice_id: invoiceId,
    scenario: Math.abs(payload.amount - expected) < 0.005 ? 'exact_match' : 'shortfall',
  });
}

export async function checkPaytmPaymentStatus(invoiceId: string): Promise<{status: string; amount_received: number; amount_expected: number; deficit?: number; utr?: string; verification_source: string}> {
  const res = await fetch(`${API_BASE}/api/counter/status/${encodeURIComponent(invoiceId)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Paytm status check failed');
  return await res.json();
}

// 4. Udhari Ledger APIs
export async function getUdhariList(): Promise<UdhariItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/udhari/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data.items || mockState.udhariList;
    }
  } catch {
    // Backend unreachable, fallback
  }
  return [...mockState.udhariList];
}

export async function sendUdhariReminder(udhariId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/udhari/send-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ udhari_id: udhariId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Could not prepare WhatsApp reminder');
  return await res.json();
}

export async function reconcileUdhariPayment(udhariId: string, amount: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/udhari/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        udhari_id: udhariId,
        amount_paid: amount,
        utr: `PAYTMUDH${Math.floor(100000 + Math.random() * 900000)}`,
      }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback
  }

  const item = mockState.udhariList.find(i => i.id === udhariId);
  if (!item) {
    return { success: false, message: 'Udhari record not found' };
  }
  if (item.status === 'SETTLED') {
    return { success: false, message: 'Udhari record is already settled' };
  }
  if (Math.abs(item.amount_due - amount) > 0.005) {
    return { success: false, message: `Settlement must match ₹${item.amount_due.toFixed(2)}` };
  }
  if (item) {
    item.status = 'SETTLED';
    item.settled_at = new Date().toISOString();
  }
  return { success: true, message: `Payment of ₹${amount} reconciled. Udhari settled!` };
}

export async function replayDemoUdhariSettlement(udhariId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/udhari/demo-settlement-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ udhari_id: udhariId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Local settlement fixture rejected');
  return await res.json();
}

// 5. Restock & Vision OCR APIs
export async function analyzeDistributorInvoice(file?: File | null): Promise<InvoiceAnalysisResponse> {
  if (file) {
    let res: Response;
    try {
      const formData = new FormData();
      formData.append('file', file);
      res = await fetch(`${API_BASE}/api/restock/analyze-invoice`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error(error instanceof Error ? `Invoice analysis unavailable: ${error.message}` : 'Invoice analysis unavailable');
    }
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Uploaded invoice could not be analyzed');
    return await res.json();
  }

  const res = await fetch(`${API_BASE}/api/restock/analyze-invoice`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    throw new Error(error instanceof Error ? `Sample analysis unavailable: ${error.message}` : 'Sample analysis unavailable');
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Sample invoice fixture could not be analyzed');
  return await res.json();
}

export async function sendPurchaseOrder(payload: {
  po_number: string;
  supplier_name: string;
  supplier_phone: string;
  items: Array<{ sku: string; quantity: number; expected_rate?: number; rate?: number }>;
}): Promise<RestockOrderResponse> {
  const res = await fetch(`${API_BASE}/api/restock/send-po`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || 'Could not save purchase order draft');
  return await res.json();
}
