# Paytm Soundbox Merchant Counter Agent

A voice-first counter workflow concept for small retailers. The web app combines bill entry, amount-linked payment handling, customer credit tracking, and distributor invoice auditing in a Soundbox-style interface.

## What the current prototype does

### 1. Voice checkout

The merchant can speak or type a bill. The parser extracts the customer, total, UPI amount, store-credit amount, contact number, and promised date. The merchant reviews the split before creating a backend invoice and credit-ledger entry.

### 2. Payment QR and mismatch guard

With Paytm Dynamic QR merchant credentials configured, the backend requests an amount-locked QR and checks Paytm’s transaction status. Only gateway results drive the match or shortfall announcement. Without those credentials, the UI does not show a placeholder QR and explains that payment verification is unavailable.

### 3. Store-credit recovery

Credit and due-date details come from the invoice. The merchant can prepare a WhatsApp reminder for review and manually press Send. The current UI does not send messages automatically or verify payments made through a credit link.

### 4. Distributor restock audit

Upload a distributor invoice photo/PDF for Gemini Vision OCR, or a CSV with `sku,quantity,unit_rate` columns for a deterministic audit. Extracted rates are compared with stored price history; increases of 5% or more are flagged. The purchase-order draft uses the uploaded invoice lines and historical rates where available. The prototype has no inventory-count feed, so it does not identify low-stock items. The merchant reviews the draft and sends it through WhatsApp.

## Integration status

- **Sarvam** handles speech transcription when `SARVAM_API_KEY` is configured.
- **Groq** can parse voice intent when `GROQ_API_KEY` is configured; typed input remains available.
- **Gemini Vision** analyzes uploaded invoice images/PDFs when `GEMINI_API_KEY` is configured.
- **Paytm Dynamic QR and settlement verification** require Paytm-issued merchant credentials. An API key alone is not sufficient.
- **WhatsApp** actions open a message draft for merchant review. The current UI does not call WhatsApp Cloud API to send it.

No API secrets belong in frontend source or Git. Put local credentials in `backend/.env`, which is ignored by Git.

## Run locally

Use two terminals from the repository root.

Backend:

```bash
cd backend
pip install -r requirements.txt
./start.sh
```

The API runs at `http://localhost:8000`; interactive docs are at `http://localhost:8000/docs`.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Next.js proxies `/api/*` and `/health` to the local backend.

## Local environment variables

Add only the integrations you have access to in `backend/.env`:

```dotenv
SARVAM_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
PAYTM_ENV=staging
PAYTM_MID=
PAYTM_MERCHANT_KEY=
PAYTM_POS_ID=
PAYTM_CLIENT_ID=
PAYTM_PUBLIC_WEBHOOK_URL=
PAYTM_WEBHOOK_SECRET=
WHATSAPP_API_TOKEN=
```

Paytm Dynamic QR is enabled only when the required Paytm merchant credentials are present. Follow the backend README for Paytm staging setup.

## Verification

Run the repository’s integration checks with:

```bash
python3 tests/test_e2e_flows.py
```

These checks exercise local API behavior; they do not prove that a live Paytm payment or WhatsApp message was completed.

## Repository layout

- `backend/app/`: FastAPI routes, database models, and speech, payment, and invoice-analysis services.
- `frontend/src/components/CheckoutTerminal.tsx`: active four-stage merchant workflow and Soundbox-style display.
- `frontend/src/lib/api.ts`: frontend API client.
- `tests/`: integration checks and invoice fixtures.
