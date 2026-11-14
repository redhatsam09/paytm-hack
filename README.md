# Vani Soundbox: Autonomous Voice-to-QR, Partial Udhari & Restock Agent

**Paytm Build for India AI Hackathon — Chennai Edition**  
**Track 1: Merchant Growth AI**  
*Real-time counter execution using a Dual-Screen Soundbox Simulator and WhatsApp Agent in English and regional languages.*

---

## 📌 Executive Summary

Across **12M+ Indian Kirana and retail stores**, UPI powers over 83% of digital transactions. Yet counter bookkeeping remains entirely manual and fragmented:
1. **Zero Typing Time:** Shopkeepers serve 3–5 customers per minute during peak evening hours (5 PM – 9 PM); opening apps to manually type credit entries causes counter queues.
2. **Passive Soundboxes:** Standard audio devices merely announce incoming money after the customer initiates it, without knowing the bill total, whether full payment was made, or if store credit was extended.
3. **Three Daily Revenue Leaks:**
   - **Split Payments / Unrecorded Partial Udhari:** ₹650 bill split into ₹400 UPI now + ₹250 credit is forgotten on paper *bahi-khata*.
   - **Short Payments & Static QR Spoofs:** Customer pays ₹40 instead of ₹400 on a printed static QR sticker and walks away.
   - **Distributor Paper Invoices & Overbilling:** Wholesale bills dumped in a drawer with unchecked wholesale rate hikes and no automated reorders.

**Vani Soundbox** transforms the Soundbox into an **active counter execution agent** coupled with a **WhatsApp back-office agent**.

---

## ⚡ The Three Core Live Demo Workflows

### Flow 1: Voice-to-Dynamic-QR & Split Udhari
* **Merchant speaks:** *"Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"*
* **Speech & Agentic Parser (<5ms):** Decomposes speech into Total (₹650), UPI Due (₹400), Udhari (₹250), Customer (Ramesh), and Due Date (Monday).
* **Soundbox Customer Screen:** Displays an amount-locked Dynamic QR code for ₹400 with a 180s countdown timer.
* **Webhook Confirmation:** Matching ₹400 webhook triggers an instant audio announcement (*"Paytm par ₹400 prapt hue"*), logs ₹250 into the SQLite Udhari ledger, and schedules an automated WhatsApp Paytm Payment Link.

### Flow 2: Real-Time Mismatch & Spoof Guard
* **Active Invoice:** Counter expects ₹400 UPI.
* **Spoof Attempt:** Webhook receives ₹40 or a fake screenshot payload.
* **Instant Deficit Alarm:** Flags `SHORTFALL_ALERT` (₹360 deficit), turns the screen emergency red, and fires a regional Hindi voice siren: *"Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!"* before the buyer steps away.

### Flow 3: WhatsApp Snap-to-Restock Agent
* **Paper Bill Photo:** Merchant snaps a picture of a distributor invoice on WhatsApp.
* **Vision OCR:** Extracts line items, quantities, and unit rates.
* **Rate Creep Auditor:** Compares unit rates against past purchase history in the database, flagging silent price increases (e.g. *Fortune Sunflower Oil 1L: ₹140 → ₹155 (+10.7% hike)*).
* **1-Click Purchase Order:** Auto-drafts PO-882 locked to baseline rates and dispatches it directly to the wholesaler's WhatsApp.

---

## 🏗️ System Architecture & Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Speech & Regional ASR** | Sarvam AI Speech API & Whisper | Hindi, Tamil, Telugu, English & Hinglish voice parsing |
| **Agentic Tool Calling** | Groq (Llama-3.3-70B) + LangGraph | Sub-600ms intent split into QR and ledger records |
| **Invoice Vision OCR** | Gemini 2.5 Flash Vision API | Table line-item extraction from paper bills |
| **Payments & Messaging** | Paytm Dynamic QR & WhatsApp API | Amount-locked QR codes & digital collection links |
| **Backend & Real-Time Sync**| FastAPI, SQLite, Server-Sent Events | Transaction state engine, UTR listener, audio alerts |
| **Frontend Workflow UI** | Next.js 16, React 19, Tailwind CSS | Point-of-Sale checkout workflow, Stripe Light tokens |

---

## 🚀 Quickstart & How to Run

### 1. Start the Backend API Server
```bash
cd /workspaces/paytm-hack/backend
bash start.sh
# Server starts on http://localhost:8000
# Interactive Swagger API Docs: http://localhost:8000/docs
```

### 2. Start the Frontend Application
```bash
cd /workspaces/paytm-hack/frontend
npm start
# Web app runs on http://localhost:3000
```

### 3. Run Automated End-to-End Verification Tests
```bash
cd /workspaces/paytm-hack
python3 tests/test_e2e_flows.py
# 9/9 tests pass with 100% verification across all 3 flows
```

---

## 🔌 API & Integration Settings (Zero-Setup Mode)
The application includes a built-in **Zero-Setup Mock Engine** that works out of the box for hackathon demonstrations with zero API key configuration. 

Users can also plug in live API keys at runtime via the UI Settings drawer or `/api/settings` endpoint:
* `SARVAM_API_KEY`: Regional speech recognition
* `GROQ_API_KEY`: Llama-3.3-70B intent parsing
* `GEMINI_API_KEY`: Gemini 2.5 Flash Vision OCR
* `WHATSAPP_API_TOKEN`: WhatsApp Business messaging
* `MERCHANT_VPA`: Counter UPI virtual payment address

---

## 📁 Repository Structure
```
.
├── PRD.md                         # Product Requirements Document & Technical Design Record
├── README.md                      # Project Overview & Setup Guide
├── backend/                       # FastAPI application & SQLite database
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point
│   │   ├── config.py              # Configuration & environment settings
│   │   ├── database.py            # SQLite async database setup & seed data
│   │   ├── models.py              # SQLAlchemy database models
│   │   ├── schemas.py             # Pydantic schemas
│   │   ├── routers/               # API endpoints (voice, counter, webhook, udhari, restock, settings)
│   │   └── services/              # Business logic (voice parser, QR generator, TTS, WhatsApp)
│   ├── requirements.txt           # Python dependencies
│   ├── start.sh                   # Backend start script
│   └── tests/                     # Backend unit tests (12/12 passed)
├── frontend/                      # Next.js 16 point-of-sale workflow application
│   ├── src/app/page.tsx           # Step-by-step counter checkout & restock workflow
│   ├── src/components/            # Workflow components (Checkout, Restock, Ledger, Settings, Display)
│   ├── src/lib/api.ts             # API client methods
│   └── src/lib/audio.ts           # Web Audio chimes & Hindi/English voice synthesizer
└── tests/                         # E2E test suite
    ├── test_e2e_flows.py          # 9 automated tests covering all 3 hackathon flows
    └── run_verification.py       # Standalone verification runner
```
