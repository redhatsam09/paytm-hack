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

### 2.1 Voice & Intent Parser (`< 600ms` latency)
- **`POST /api/voice/parse`**
  Parses natural language speech transcripts (English, Hindi, Hinglish) into structured counter split entities.
  - **Sample Request:**
    ```json
    {
      "transcript_text": "Customer bill 650, 400 UPI now, 250 udhari for Monday, Ramesh 9876543210"
    }
    ```
  - **Sample Response:**
    ```json
    {
      "success": true,
      "transcript": "Customer bill 650, 400 UPI now, 250 udhari for Monday, Ramesh 9876543210",
      "latency_ms": 1.84,
      "data": {
        "total_bill": 650.0,
        "upi_amount": 400.0,
        "udhari_amount": 250.0,
        "cash_amount": 0.0,
        "due_date": "2026-11-16",
        "customer_name": "Ramesh",
        "customer_phone": "9876543210",
        "items": []
      }
    }
    ```

### 2.2 Counter & Dynamic QR Generation
- **`POST /api/counter/create-invoice`**
  Generates an amount-locked NPCI/Paytm UPI QR payload and base64 PNG data URL, saves transaction, initializes Udhari ledger draft if credit is split, and broadcasts to customer display screen.
  - **Sample Request:**
    ```json
    {
      "total_bill": 650.0,
      "upi_due": 400.0,
      "udhari_amount": 250.0,
      "customer_name": "Ramesh",
      "customer_phone": "9876543210",
      "due_date": "2026-11-17"
    }
    ```
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
  - **Exact amount match:**
    - Status: `SUCCESS`
    - Audio Announcement: `"Paytm par ₹400 prapt hue"`
    - Dual-Screen: Broadcasts green tick success animation
    - WhatsApp: Prepares customer credit collection link
  - **Shortfall or amount mismatch:**
    - Status: `SHORTFALL_ALERT`
    - Audio Warning: `"Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!"`
    - Dual-Screen: Broadcasts red emergency siren warning with deficit amount

### 2.4 WhatsApp & Partial Udhari Ledger
- **`GET /api/udhari/list`**
  Lists all ledger records (UNPAID, REMINDER_SENT, SETTLED).
- **`POST /api/udhari/send-reminder`**
  Sends an interactive WhatsApp reminder containing a 1-click `https://p.paytm.me/pay?id=...` payment link.
- **`POST /api/udhari/reconcile`**
  Webhook simulation when customer completes payment via WhatsApp payment link, settling the ledger entry.
- **`POST /api/udhari/create`**
  Directly registers a store credit record.

### 2.5 Snap-to-Restock Agent (Vision OCR & Wholesale Price Auditor)
- **`POST /api/restock/analyze-invoice`**
  Accepts uploaded paper bill photograph. Extracts SKU line items, compares unit rates against past supplier invoices in SQLite DB, flags price hikes > 5%, and auto-drafts a low-stock Purchase Order (PO).
- **`GET /api/restock/price-history`**
  Returns historical wholesale rates for staple SKUs.
- **`POST /api/restock/send-po`**
  Dispatches Purchase Order to supplier WhatsApp thread.
- **`GET /api/restock/orders`**
  Lists all wholesale restock orders.

### 2.6 Server-Sent Events (SSE)
- **`GET /api/events`**
  Continuous SSE stream for the dual-screen interface. Events pushed:
  - `INVOICE_CREATED`
  - `PAYMENT_SUCCESS`
  - `SHORTFALL_ALERT`
  - `COUNTER_RESET`
  - `UDHARI_SETTLED`
  - `PO_DISPATCHED`

### 2.7 Runtime Configuration & Integration Settings
- **`GET /api/settings`**
  Returns current engine mode (`ZERO_SETUP_MOCK` vs `LIVE_API`), masked key statuses, merchant VPA, and language preferences.
- **`POST /api/settings`**
  Updates runtime keys (`sarvam_api_key`, `groq_api_key`, `gemini_api_key`, `whatsapp_api_token`, `paytm_webhook_secret`, `merchant_vpa`, `merchant_name`) dynamically on the fly.

---

## 3. Database Schema (SQLite)

1. **`merchants`**: Store settings, VPA (`srilakshmi@paytm`), phone, preferred language.
2. **`transactions`**: Counter bills, status (`PENDING_PAYMENT`, `COMPLETED`, `SHORT_PAYMENT`), UTR, QR data.
3. **`udhari_ledger`**: Customer credit records, due dates, statuses (`UNPAID`, `REMINDER_SENT`, `SETTLED`), Paytm payment links.
4. **`sku_price_history`**: Historical distributor unit rates for price hike detection.
5. **`restock_orders`**: Wholesaler purchase orders and WhatsApp dispatch logs.
