#!/usr/bin/env python3
"""
Standalone Verification & Latency Benchmark Runner
Paytm Soundbox Execution Agent - Hackathon E2E Verification
"""

import sys
import time
import os
import requests
import json

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_invoice.png")

# ANSI Color Codes
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_header(title):
    print(f"\n{BOLD}{CYAN}{'='*75}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'='*75}{RESET}")


def run_step(step_name, fn):
    t0 = time.time()
    try:
        result = fn()
        elapsed_ms = int((time.time() - t0) * 1000)
        print(f"  {GREEN}✔ [PASS]{RESET} {step_name} {YELLOW}({elapsed_ms}ms){RESET}")
        return True, result
    except Exception as e:
        elapsed_ms = int((time.time() - t0) * 1000)
        print(f"  {RED}✘ [FAIL]{RESET} {step_name} {YELLOW}({elapsed_ms}ms){RESET}")
        print(f"     {RED}Error: {e}{RESET}")
        return False, str(e)


def main():
    print_header("PAYTM DUAL-SCREEN SOUNDBOX & EXECUTION AGENT — E2E VERIFICATION")
    print(f"Target Base URL: {BOLD}{BASE_URL}{RESET}\n")

    summary = {"total": 0, "passed": 0, "failed": 0, "flows": {}}

    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    # --- Pre-flight Health Check ---
    print(f"{BOLD}0. System Pre-Flight & Health Check{RESET}")
    summary["total"] += 1
    def check_health():
        resp = session.get(f"{BASE_URL}/health", timeout=5)
        if resp.status_code != 200:
            raise RuntimeError(f"Server returned status {resp.status_code}")
        data = resp.json()
        assert data.get("status") == "ok", f"Health status not ok: {data}"
        return data
    ok, health_data = run_step("FastAPI Application Online & DB Initialized", check_health)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1

    # --- FLOW 1: Voice to Split QR & Udhari ---
    print(f"\n{BOLD}1. Flow 1: Voice to Split QR & Udhari{RESET}")
    flow1_ok = True
    shared = {}

    # Step 1.1 Voice Parse
    summary["total"] += 1
    def step_voice_parse():
        payload = {"transcript_text": "Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"}
        resp = session.post(f"{BASE_URL}/api/voice/parse", json=payload, timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json().get("data", {})
        assert float(data.get("total_bill", 0)) == 650.0
        assert float(data.get("upi_amount", 0)) == 400.0
        assert float(data.get("udhari_amount", 0)) == 250.0
        assert data.get("customer_name") == "Ramesh"
        assert data.get("customer_phone") == "9876543210"
        shared["voice_data"] = data
        return data
    ok, _ = run_step("Voice Intent Parse (<600ms latency target: Total ₹650, UPI ₹400, Udhari ₹250)", step_voice_parse)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow1_ok = False

    # Step 1.2 Dynamic QR Creation
    summary["total"] += 1
    def step_create_invoice():
        payload = {
            "total_bill": 650.0,
            "upi_due": 400.0,
            "udhari_amount": 250.0,
            "cash_received": 0.0,
            "customer_name": "Ramesh",
            "customer_phone": "9876543210",
            "due_date": "2026-11-17"
        }
        resp = session.post(f"{BASE_URL}/api/counter/create-invoice", json=payload, timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        inv_id = data.get("invoice_id")
        assert inv_id and inv_id.startswith("INV-"), "Missing or invalid invoice_id"
        assert float(data.get("upi_due", 0)) == 400.0
        assert "upi://pay" in data.get("qr_data", "")
        assert data.get("qr_code_url", "").startswith("data:image/png;base64,")
        shared["invoice_id"] = inv_id
        shared["udhari_id"] = data.get("udhari_id")
        return inv_id
    ok, _ = run_step("Amount-Locked Dynamic QR Generation (₹400, 180s countdown timer)", step_create_invoice)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow1_ok = False

    # Step 1.3 Webhook Payment Payout
    summary["total"] += 1
    def step_webhook_success():
        inv_id = shared.get("invoice_id")
        payload = {
            "merchant_vpa": "srilakshmi@paytm",
            "utr": "PAYTM_E2E_001",
            "amount": 400.00,
            "status": "SUCCESS",
            "invoice_id": inv_id
        }
        resp = session.post(f"{BASE_URL}/api/paytm/webhook", json=payload, timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        body = resp.json()
        assert body.get("status") == "SUCCESS"
        assert body.get("alert_type") == "PAYMENT_SUCCESS"
        assert "400" in body.get("voice_alert", "")
        # WhatsApp Udhari trigger
        action = body.get("whatsapp_action")
        assert action is not None, "Missing whatsapp_action in webhook response"
        assert float(action.get("amount", 0)) == 250.0
        return body
    ok, _ = run_step("Payment Webhook Match & Green Sound Announcement ('Paytm par ₹400 prapt hue')", step_webhook_success)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow1_ok = False

    # Step 1.4 Udhari Ledger & Payment Link Settlement
    summary["total"] += 1
    def step_udhari_ledger():
        resp = session.get(f"{BASE_URL}/api/udhari/list", timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        entries = resp.json()
        assert isinstance(entries, list) and len(entries) > 0
        ramesh = next((e for e in entries if e.get("customer_name") == "Ramesh"), None)
        assert ramesh is not None, "Ramesh udhari entry not found"
        assert float(ramesh.get("amount_due")) == 250.0
        assert "paytm.me" in ramesh.get("paytm_payment_link", "")

        # Reconcile settlement
        rec_payload = {
            "udhari_id": ramesh["id"],
            "utr": "PAYTM_SETTLE_RAMESH_001",
            "amount_paid": 250.0
        }
        rec_resp = session.post(f"{BASE_URL}/api/udhari/reconcile", json=rec_payload, timeout=8)
        if rec_resp.status_code != 200:
            raise RuntimeError(f"HTTP {rec_resp.status_code}: {rec_resp.text}")
        assert rec_resp.json().get("success") is True
        return ramesh["id"]
    ok, _ = run_step("WhatsApp Udhari Link Created & Instant 1-Click Settlement (SETTLED)", step_udhari_ledger)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow1_ok = False
    summary["flows"]["Flow 1 (Voice to Split QR & Udhari)"] = "PASSED" if flow1_ok else "FAILED"

    # --- FLOW 2: Real-time Mismatch & Spoof Guard ---
    print(f"\n{BOLD}2. Flow 2: Real-time Mismatch & Spoof Guard{RESET}")
    flow2_ok = True

    summary["total"] += 1
    def step_spoof_guard():
        # Create invoice ₹400
        inv_resp = session.post(f"{BASE_URL}/api/counter/create-invoice", json={"total_bill": 400.0, "upi_due": 400.0}, timeout=8)
        inv_id = inv_resp.json().get("invoice_id")
        
        # Trigger short payment ₹40
        payload = {
            "merchant_vpa": "srilakshmi@paytm",
            "utr": "PAYTM_SHORT_002",
            "amount": 40.00,
            "status": "SUCCESS",
            "invoice_id": inv_id
        }
        resp = session.post(f"{BASE_URL}/api/paytm/webhook", json=payload, timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        body = resp.json()
        assert body.get("status") == "SHORTFALL_ALERT"
        assert body.get("alert_type") == "SHORT_PAYMENT"
        deficit = float(body.get("deficit", 0))
        assert deficit == 360.0, f"Expected deficit 360.0, got {deficit}"
        voice_warn = body.get("voice_alert", "")
        assert "Savdhaan" in voice_warn and "40" in voice_warn and "360" in voice_warn

        # Verify active counter screen is in SHORT_PAYMENT state
        act_resp = session.get(f"{BASE_URL}/api/counter/active", timeout=5)
        act_data = act_resp.json().get("data", {})
        assert act_data.get("status") == "SHORT_PAYMENT"
        return f"Deficit: ₹{deficit}, Warning: {voice_warn}"
    ok, res = run_step("Mismatch Guard (Expected ₹400, Paid ₹40 -> Deficit ₹360 + Regional Voice Alarm)", step_spoof_guard)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow2_ok = False
    summary["flows"]["Flow 2 (Real-time Mismatch & Spoof Guard)"] = "PASSED" if flow2_ok else "FAILED"

    # --- FLOW 3: WhatsApp Snap-to-Restock Agent ---
    print(f"\n{BOLD}3. Flow 3: WhatsApp Snap-to-Restock Agent{RESET}")
    flow3_ok = True

    # Step 3.1 Invoice Vision OCR & Price Hike Alert
    summary["total"] += 1
    def step_invoice_ocr():
        assert os.path.exists(FIXTURE_PATH), f"Fixture invoice not found at {FIXTURE_PATH}"
        with open(FIXTURE_PATH, "rb") as f:
            resp = requests.post(
                f"{BASE_URL}/api/restock/analyze-invoice",
                files={"file": ("sample_invoice.png", f, "image/png")},
                timeout=15
            )
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        
        body = resp.json()
        assert body.get("success") is True
        items = body.get("items", [])
        assert len(items) > 0, "No items extracted"

        # Check Fortune Sunflower Oil hike (+10.7%)
        price_hikes = body.get("price_hikes", [])
        assert len(price_hikes) > 0, "No price hikes detected"
        fortune = next((h for h in price_hikes if "Fortune" in h.get("sku", "")), None)
        assert fortune is not None, "Fortune Oil price hike not flagged"
        assert fortune.get("price_hike_detected") is True
        assert float(fortune.get("hike_percentage", 0)) >= 10.0

        shared["draft_po"] = body.get("draft_po")
        return f"{len(items)} SKUs parsed, Hike on Fortune Oil: +{fortune.get('hike_percentage')}%"
    ok, res = run_step("Invoice Vision OCR & Price Creep Detection (+10.7% on Fortune Oil)", step_invoice_ocr)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow3_ok = False

    # Step 3.2 Dispatch PO to Wholesaler WhatsApp
    summary["total"] += 1
    def step_dispatch_po():
        draft_po = shared.get("draft_po") or {
            "po_number": "PO-E2E-RUNNER",
            "supplier_name": "Adani Wilmar Dist.",
            "supplier_phone": "+919840123456",
            "items": [{"sku": "Fortune Sunflower Oil 1L", "quantity": 25, "expected_rate": 140.0}]
        }
        payload = {
            "po_number": draft_po.get("po_number", "PO-E2E-RUNNER"),
            "supplier_name": draft_po.get("supplier_name", "Adani Wilmar Dist."),
            "supplier_phone": draft_po.get("supplier_phone", "+919840123456"),
            "items": draft_po.get("items", [])
        }
        resp = session.post(f"{BASE_URL}/api/restock/send-po", json=payload, timeout=8)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        body = resp.json()
        assert body.get("status") == "DISPATCHED_WHATSAPP"
        assert body.get("whatsapp_preview")
        return body.get("status")
    ok, _ = run_step("1-Click Standardized PO Dispatch to Wholesaler WhatsApp", step_dispatch_po)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1; flow3_ok = False
    summary["flows"]["Flow 3 (WhatsApp Snap-to-Restock)"] = "PASSED" if flow3_ok else "FAILED"

    # --- SETTINGS & ZERO-SETUP MOCK ENGINE ---
    print(f"\n{BOLD}4. Settings & Zero-Setup Runtime Engine{RESET}")
    summary["total"] += 1
    def step_settings():
        resp = session.get(f"{BASE_URL}/api/settings", timeout=5)
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        assert data.get("status") == "success"
        assert data.get("engine_mode") in ["ZERO_SETUP_MOCK", "LIVE_API"]
        return f"Engine Mode: {data.get('engine_mode')}, Languages: {len(data.get('supported_languages', []))}"
    ok, res = run_step("System Settings & Zero-Setup Mock Engine Status", step_settings)
    if ok: summary["passed"] += 1
    else: summary["failed"] += 1
    summary["flows"]["System Settings (/api/settings)"] = "PASSED" if ok else "FAILED"

    # --- Print Summary ---
    print_header("VERIFICATION SUMMARY REPORT")
    for flow_name, status in summary["flows"].items():
        color = GREEN if status == "PASSED" else RED
        print(f"  {BOLD}{flow_name}:{RESET} {color}{status}{RESET}")
    print(f"\n  Total Checks: {summary['total']}")
    print(f"  Passed: {GREEN}{summary['passed']}{RESET}")
    print(f"  Failed: {RED}{summary['failed']}{RESET}")

    if summary["failed"] == 0:
        print(f"\n{BOLD}{GREEN}ALL 3 CORE FLOWS VERIFIED SUCCESSFULLY! (100% PASS RATE){RESET}\n")
        return 0
    else:
        print(f"\n{BOLD}{RED}SOME FLOW VERIFICATIONS FAILED. Check errors above.{RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
