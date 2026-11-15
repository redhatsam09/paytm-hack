# Paytm Soundbox Autonomous Merchant Agent — Backend API

Autonomous Voice-to-QR, Real-Time Webhook Spoof Guard, Partial Udhari & Snap-to-Restock Agent backend built with **FastAPI**, **SQLAlchemy** + **aiosqlite** (SQLite), and **gTTS / Web Audio**.

---

## 1. Quick Start

### Prerequisites
- Python 3.12+ (tested on Python 3.14)
- Virtualenv or system Python with `pip`

### Installation
```bash
cd /workspaces/paytm-hack/backend
pip install -r requirements.txt
```

For local AI credentials, put environment variables such as `SARVAM_API_KEY=...` in `backend/.env`. `start.sh` loads this ignored local file into the backend process; do not add credentials to frontend code or commit the file. Audio transcription uses Sarvam Saaras v4 with automatic language detection, then parses the transcript into the checkout split.

### Running the Server
```bash
./start.sh
# Server starts on http://0.0.0.0:8000
# Interactive Swagger Documentation: http://localhost:8000/docs
# Interactive ReDoc: http://localhost:8000/redoc
# Health Check: http://localhost:8000/health
```

### Paytm Dynamic QR staging setup

The local preview QR is not a Paytm transaction. For a verifiable payment prototype, set the following on the **backend only** using Paytm issued staging credentials:

```bash
export PAYTM_ENV=staging
export PAYTM_MID=your_staging_mid
export PAYTM_MERCHANT_KEY=your_staging_merchant_key
export PAYTM_POS_ID=your_assigned_pos_id
# Optional, only when Paytm has issued a client ID for multiple keys:
export PAYTM_CLIENT_ID=your_client_id
export PAYTM_PUBLIC_WEBHOOK_URL=https://your-public-host/api/paytm/webhook
```

Paytm's Dynamic QR product is limited to approved enterprise merchants. Without those credentials, the app stays in `DEMO_ONLY` mode and labels all QR/payment controls as simulation. Do not use production credentials for this prototype. Configure the HTTPS webhook URL in the Paytm staging merchant dashboard; Paytm only accepts webhook URLs on port 443.

### Running Tests
```bash
pytest -v
```

---

## 2. API Endpoints Reference

### 2.1 Voice & Intent Parser
- **`POST /api/voice/parse`**
  Parses natural language speech transcripts (English, Hindi, Hinglish) into structured counter split entities. Latency depends on the configured speech and language-model providers.
  The request accepts `transcript_text` and an optional language. The response contains the recognized transcript, measured latency, and parsed bill fields: total, UPI, credit, cash, due date, customer name, and phone.

### 2.2 Counter & Dynamic QR Generation
- **`POST /api/counter/create-invoice`**
  Saves the transaction and optional Udhari ledger entry. With Paytm merchant credentials it requests a Paytm Dynamic QR. Without them, a UPI bill gets an explicitly non-payable `DEMO` QR for interface review. A credit-only invoice has no QR.
- **`GET /api/counter/active`**
  Retrieves active counter invoice state for dual-screen synchronization.
- **`POST /api/counter/reset`**
  Resets counter to idle standby mode.
- **`GET /api/counter/history`**
  Lists recent counter transactions.

### 2.3 Paytm Webhook Listener & Spoof Guard
- **`POST /api/paytm/webhook`**
  Real Paytm callback endpoint. It validates Paytm's `CHECKSUMHASH`, matches the MID and order to a Paytm-issued QR, then calls Paytm's Transaction Status API before reconciliation. It never accepts a browser-supplied amount as proof of payment.
- **`GET /api/counter/status/{invoice_id}`**
  Queries Paytm Transaction Status API and only settles a Paytm-issued QR order after a verified exact amount.
- **`POST /api/paytm/demo-fixture`**
  Runs a fixed server-generated HMAC fixture (`exact_match` or `shortfall`) through the reconciliation path. This exercises the app's matching and alert behavior, but is not a Paytm signature and does not move money. Disabled once Paytm credentials are configured.
  This endpoint remains available for backend integration checks; it is not exposed as a payment control in the active web UI. It is not a Paytm signature and does not move money.
  - Exact amount match returns `SUCCESS`.
  - Shortfall returns `SHORTFALL_ALERT` with the deficit amount.

### 2.4 WhatsApp & Partial Udhari Ledger
- **`GET /api/udhari/list`**
  Lists all ledger records (UNPAID, SETTLED). Preparing a WhatsApp draft does not change settlement state.
- **`POST /api/udhari/send-reminder`**
  Prepares a WhatsApp message payload. It does not send WhatsApp messages. The active web UI prepares a reminder without presenting an unverified Paytm collection link.
- **`POST /api/udhari/reconcile`**
  Local demo reconciliation only. It rejects client-supplied settlement for invoices created in Paytm live mode.
- **`POST /api/udhari/demo-settlement-fixture`**
  Runs a server-generated exact-balance fixture without accepting a browser-supplied amount. It is disabled when Paytm live credentials are configured and does not prove money moved.
- **`POST /api/udhari/create`**
  Directly registers a store credit record.

### 2.5 Snap-to-Restock Agent (Vision OCR & Wholesale Price Auditor)
- **`POST /api/restock/analyze-invoice`**
  Accepts a CSV (`sku,quantity,unit_rate`) for a deterministic price audit, or an image/PDF for Gemini OCR when `GEMINI_API_KEY` is configured. Extracted rates are compared with supplier history and the draft PO is built from the uploaded line items. A request without a file selects the backend's explicitly labeled local fixture; the active web UI always requires an uploaded file.
- **`GET /api/restock/price-history`**
  Returns historical wholesale rates for staple SKUs.
- **`POST /api/restock/send-po`**
  Saves a purchase-order draft and returns its WhatsApp message preview. The merchant must press Send in WhatsApp; this endpoint does not dispatch the message.
- **`GET /api/restock/orders`**
  Lists all wholesale restock orders.

### 2.6 Server-Sent Events (SSE)
- **`GET /api/events`**
  Continuous SSE stream for the counter interface. Events pushed:
  - `INVOICE_CREATED`
  - `PAYMENT_SUCCESS`
  - `SHORTFALL_ALERT`
  - `COUNTER_RESET`
  - `UDHARI_SETTLED`
  - `PO_DRAFT_READY`

### 2.7 Runtime Configuration & Integration Settings
- **`GET /api/settings`**
  Returns current engine mode (`ZERO_SETUP_MOCK` vs `LIVE_API`), masked key statuses, merchant VPA, and language preferences.
- **`POST /api/settings`**
  Updates runtime keys (`sarvam_api_key`, `groq_api_key`, `gemini_api_key`, `whatsapp_api_token`, `paytm_webhook_secret`, `merchant_vpa`, `merchant_name`) dynamically on the fly.

---

## 3. Database Schema (SQLite)

1. **`merchants`**: Store settings, VPA (`srilakshmi@paytm`), phone, preferred language.
2. **`transactions`**: Counter bills, status (`PENDING_PAYMENT`, `COMPLETED`, `SHORT_PAYMENT`), UTR, QR data.
3. **`udhari_ledger`**: Customer credit records, due dates, statuses (`UNPAID`, `SETTLED`), and payment-link previews.
4. **`sku_price_history`**: Historical distributor unit rates for price hike detection.
5. **`restock_orders`**: Wholesaler purchase-order drafts and WhatsApp message previews.
