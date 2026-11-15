# Autonomous Voice-to-QR, Store Credit & Restock Agent

Paytm Build for India AI Hackathon - Chennai Edition  
Track 1: Merchant Growth AI  
Real-time counter execution using a Dual-Screen Soundbox Simulator and WhatsApp Agent.

---

## Executive Summary

Across more than 12 million Indian retail merchants, UPI processes over 83% of digital transactions. However, counter checkout and bookkeeping remain manual and disconnected:

1. Zero Typing Latency: Merchants serve 3 to 5 customers per minute during peak checkout rush hours. Opening dedicated mobile apps and typing customer names or credit balances creates counter bottlenecks.
2. Passive Soundboxes: Standard hardware soundboxes merely announce incoming digital credits after a buyer initiates them. They have no prior context regarding the invoice total, split balances, or store credit agreements.
3. Three Daily Revenue Leaks:
   - Split Payments and Unrecorded Credit: Bills split between immediate digital payment and delayed credit are frequently forgotten during peak hours.
   - Short Payments and Static QR Spoofing: Buyers manually enter incorrect amounts on static printed QR stickers (such as paying 40 instead of 400) without real-time counter mismatch detection.
   - Paper Invoices and Price Creep: Distributor paper bills are filed manually without tracking silent supplier price increases or automated restocking triggers.

This solution transforms the counter Soundbox into an active, voice-driven execution terminal paired with an automated WhatsApp recovery and restock agent.

---

## Core Demonstration Workflows

### Flow 1: Voice-to-Dynamic-QR and Store Credit Split
- Voice Command: The merchant speaks naturally: "Customer bill 650 - 400 UPI now, 250 credit for Monday, Ramesh 9876543210".
- Fast Intent Decomposition: The agent extracts Total (650), Digital Due (400), Store Credit (250), Due Date (Monday), and Customer Name (Ramesh).
- Dynamic QR Generation: The counter display immediately generates a dynamic amount-locked QR code locked to exactly 400 with a 180-second countdown timer.
- Webhook Confirmation: A matching 400 payment webhook triggers an immediate confirmation chime, records the 250 credit balance into the persistent ledger, and schedules an automated WhatsApp digital payment link for the customer.

### Flow 2: Real-Time Shortfall Mismatch and Spoof Defense
- Expected Transaction: Counter expects 400 UPI payment.
- Spoof / Shortfall Attempt: The incoming webhook reports 40 (or a simulated payment spoof).
- Immediate Alert: The terminal flags a shortfall of 360, transitions the screen to an urgent alert state, and triggers an immediate regional audio warning before the customer leaves the counter.

### Flow 3: WhatsApp Snap-to-Restock Agent
- Invoice Capture: The merchant uploads or photographs a paper delivery invoice on WhatsApp.
- Vision OCR Extraction: The agent extracts line items, quantities, unit prices, and supplier metadata.
- Price Creep Detection: The system audits current unit rates against historical purchase records in the database, automatically flagging supplier price increases (such as Sunflower Oil increasing from 140 to 155, representing a 10.7% price hike).
- Purchase Order Dispatch: The agent automatically drafts a standardized purchase order locked to baseline rates and dispatches it directly to the supplier via WhatsApp.

---

## Technology Architecture and Stack

| System Layer | Technology | Function |
| :--- | :--- | :--- |
| Speech and Regional Voice | Sarvam AI Speech API, Whisper | Voice parsing supporting English and regional dialects |
| Agentic Intent Decomposition | Groq (Llama-3.3-70B), LangGraph | Sub-600ms extraction of transaction entities and amounts |
| Invoice Vision OCR | Google Gemini 2.5 Flash Vision API | Tabular line-item extraction from photographed paper invoices |
| Payment and Messaging | Paytm Dynamic QR, WhatsApp Cloud API | Amount-locked QR payloads and automated digital collection links |
| Backend Application Server | FastAPI, SQLite, Server-Sent Events | Transaction state engine, UTR listener, audio alert synthesizer |
| Frontend Workflow UI | Next.js 16, React 19, Tailwind CSS | Point-of-sale checkout workflow with Sarvam Sovereign AI styling |

---

## Getting Started

### 1. Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- npm 9 or higher

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
bash start.sh
```
- API Base URL: `http://localhost:8000`
- Interactive API Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
npm start
```
- Web Application: `http://localhost:3000`

### 4. Running Automated End-to-End Tests
```bash
python3 tests/test_e2e_flows.py
```
All 9 test cases validate end-to-end functionality across voice parsing, invoice creation, payment matching, shortfall detection, ledger reconciliation, and restock OCR.

---

## Configuration and Runtime Integration

The terminal operates with a zero-setup fallback engine out of the box, ensuring that all workflows can be demonstrated locally without external dependencies. 

For live production deployments, credentials can be set via environment variables or runtime configuration:
- `SARVAM_API_KEY`: Indic regional speech recognition
- `GROQ_API_KEY`: Low-latency Llama-3.3-70B intent parsing
- `GEMINI_API_KEY`: Vision OCR for distributor invoice analysis
- `WHATSAPP_API_TOKEN`: WhatsApp Business Cloud API access token
- `PAYTM_MERCHANT_VPA`: Counter UPI merchant payment address

---

## Repository Structure

```
.
|-- PRD.md                         Product Requirements Document
|-- README.md                      Project Overview and Execution Guide
|-- backend/                       FastAPI Application Server
|   |-- app/
|   |   |-- main.py                FastAPI application entry point
|   |   |-- config.py              Runtime settings and environment variables
|   |   |-- database.py            SQLite async database and seed data
|   |   |-- models.py              SQLAlchemy ORM models
|   |   |-- schemas.py             Pydantic v2 validation models
|   |   |-- routers/               API endpoints (voice, counter, webhook, udhari, restock, settings)
|   |   `-- services/              Business logic (voice parser, QR generator, TTS, WhatsApp)
|   |-- requirements.txt           Python dependencies
|   |-- start.sh                   Backend startup script
|   `-- tests/                     Backend test suite
|-- frontend/                      Next.js 16 Workflow Application
|   |-- src/
|   |   |-- app/                   Application layout and page routes
|   |   |-- components/            Workflow components (CheckoutTerminal, TopNavbar, QRCodeDisplay)
|   |   `-- lib/                   API client and Web Audio helpers
|   |-- package.json               Node dependencies
|   `-- tsconfig.json              TypeScript configuration
`-- tests/                         Integration Test Suite
    |-- test_e2e_flows.py          Automated end-to-end test verification
    `-- run_verification.py        Standalone verification runner
```
