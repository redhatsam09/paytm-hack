"""
End-to-End Integration and Flow Verification Test Suite
Paytm Build for India AI Hackathon - Chennai Edition
Track 1: Merchant Growth AI

Tests the 3 demonstrable flows defined in PRD.md:
1. Flow 1 (Voice to Split QR & Udhari): Voice Parse -> Dynamic QR -> Webhook Payout -> Green Tick Soundbox Announcement -> WhatsApp Udhari Link Creation -> Settlement
2. Flow 2 (Real-time Mismatch & Spoof Guard): Expected ₹400 -> Incoming ₹40 -> Shortfall Deficit ₹360 -> Regional Voice Warning ("Savdhaan! Keval ₹40...")
3. Flow 3 (WhatsApp Snap-to-Restock): Invoice Image Upload -> Vision OCR -> Historical Price Hike (+10.7% on Fortune Oil) -> Draft PO -> 1-Click WhatsApp Dispatch
"""

import os
import json
import pytest
import requests

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
SAMPLE_INVOICE_PATH = os.path.join(FIXTURE_DIR, "sample_invoice.png")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# =========================================================================
# PRE-FLIGHT: Server Health
# =========================================================================

def test_00_server_health(api_client):
    """Verify backend server is running, healthy, and initialized."""
    try:
        resp = api_client.get(f"{BASE_URL}/health", timeout=5)
        assert resp.status_code == 200, f"Server health check failed: {resp.status_code}"
        data = resp.json()
        assert data.get("status") == "ok"
        print(f"\n[PASS] Backend Server Online: {data.get('service')} v{data.get('version')}")
    except requests.exceptions.ConnectionError:
        pytest.fail(f"Could not connect to backend server at {BASE_URL}. Ensure it is running on port 8000.")


# =========================================================================
# FLOW 1: Voice to Split QR & Udhari
# =========================================================================

def test_01_flow1_voice_parsing(api_client):
    """
    Flow 1 - Step 1: Voice parsing endpoint (/api/voice/parse)
    Input: 'Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210'
    Expected: Extracted total_bill=650.0, upi_amount=400.0, udhari_amount=250.0, customer_name='Ramesh', customer_phone='9876543210'
    """
    payload = {
        "transcript_text": "Customer bill ₹650 — ₹400 UPI now, ₹250 udhari for Monday, Ramesh 9876543210"
    }
    resp = api_client.post(f"{BASE_URL}/api/voice/parse", json=payload, timeout=8)
    assert resp.status_code == 200, f"Voice parse failed: {resp.text}"
    body = resp.json()
    assert body.get("success") is True
    assert body.get("latency_ms") is not None

    data = body.get("data", {})
    assert float(data.get("total_bill", 0)) == 650.0
    assert float(data.get("upi_amount", 0)) == 400.0
    assert float(data.get("udhari_amount", 0)) == 250.0
    assert data.get("customer_name") == "Ramesh"
    assert data.get("customer_phone") == "9876543210"
    assert data.get("due_date") is not None
    print(f"\n[PASS] Flow 1 - Voice Parse (Latency: {body.get('latency_ms')}ms): {data}")


def test_02_flow1_create_dynamic_invoice_and_qr(api_client):
    """
    Flow 1 - Step 2: Create amount-locked Dynamic QR invoice (/api/counter/create-invoice)
    Expected: invoice_id generated, upi_due locked to ₹400, dynamic QR payload, 180s expiry, udhari drafted
    """
    payload = {
        "total_bill": 650.0,
        "upi_due": 400.0,
        "udhari_amount": 250.0,
        "cash_received": 0.0,
        "customer_name": "Ramesh",
        "customer_phone": "9876543210",
        "due_date": "2026-11-17"
    }
    resp = api_client.post(f"{BASE_URL}/api/counter/create-invoice", json=payload, timeout=8)
    assert resp.status_code == 200, f"Create invoice failed: {resp.text}"
    body = resp.json()

    invoice_id = body.get("invoice_id")
    assert invoice_id and invoice_id.startswith("INV-"), f"Invalid invoice_id: {invoice_id}"
    assert float(body.get("upi_due", 0)) == 400.0
    assert float(body.get("amount", 0)) == 400.0
    assert body.get("status") == "PENDING_PAYMENT"
    assert body.get("qr_data") and "upi://pay" in body.get("qr_data")
    assert body.get("qr_code_url") and body.get("qr_code_url").startswith("data:image/png;base64,")
    assert body.get("expires_in") == 180
    assert body.get("udhari_id") is not None

    # Verify active counter screen sync (/api/counter/active)
    active_resp = api_client.get(f"{BASE_URL}/api/counter/active", timeout=5)
    assert active_resp.status_code == 200
    active_body = active_resp.json()
    assert active_body.get("active") is True
    assert active_body.get("data", {}).get("invoice_id") == invoice_id

    print(f"\n[PASS] Flow 1 - Created Dynamic Invoice: {invoice_id}, Amount: ₹{body.get('amount')}, Status={body.get('status')}")


def test_03_flow1_webhook_matching_payment(api_client):
    """
    Flow 1 - Step 3: Webhook payment match & sound alert (/api/paytm/webhook)
    Expected: Webhook confirms ₹400, status SUCCESS, triggers 'Paytm par ₹400 prapt hue', WhatsApp Udhari link
    """
    # Create invoice first
    create_payload = {
        "total_bill": 650.0,
        "upi_due": 400.0,
        "udhari_amount": 250.0,
        "customer_name": "Ramesh",
        "customer_phone": "9876543210",
        "due_date": "2026-11-17"
    }
    inv_resp = api_client.post(f"{BASE_URL}/api/counter/create-invoice", json=create_payload, timeout=8)
    invoice_id = inv_resp.json()["invoice_id"]

    # Trigger webhook with exact matching payment ₹400
    webhook_payload = {
        "merchant_vpa": "srilakshmi@paytm",
        "utr": "PAYTM992817361",
        "amount": 400.00,
        "status": "SUCCESS",
        "invoice_id": invoice_id
    }
    resp = api_client.post(f"{BASE_URL}/api/paytm/webhook", json=webhook_payload, timeout=8)
    assert resp.status_code == 200, f"Webhook failed: {resp.text}"
    body = resp.json()

    assert body.get("status") == "SUCCESS"
    assert body.get("alert_type") == "PAYMENT_SUCCESS"
    assert body.get("amount_received") == 400.0
    assert body.get("deficit") == 0.0

    voice_alert = body.get("voice_alert", "")
    assert "400" in voice_alert and "prapt" in voice_alert
    print(f"\n[PASS] Flow 1 - Webhook Payment Match: Voice Alert='{voice_alert}', Audio URL={body.get('audio_url')}")

    # WhatsApp Udhari link generation check
    whatsapp_action = body.get("whatsapp_action")
    assert whatsapp_action is not None
    assert "Ramesh" in whatsapp_action.get("customer_name", "")
    assert float(whatsapp_action.get("amount", 0)) == 250.0
    assert "paytm.me" in whatsapp_action.get("payment_link", "")
    print(f"[PASS] Flow 1 - WhatsApp Udhari Action: Dispatched Link {whatsapp_action.get('payment_link')} for ₹250")


def test_04_flow1_udhari_ledger_and_reconciliation(api_client):
    """
    Flow 1 - Step 4: Udhari ledger record & customer 1-click reconciliation (/api/udhari/list & /api/udhari/reconcile)
    Expected: Ramesh ₹250 listed in ledger with payment link; settlement marks status as SETTLED
    """
    resp = api_client.get(f"{BASE_URL}/api/udhari/list", timeout=8)
    assert resp.status_code == 200, f"Udhari list failed: {resp.text}"
    entries = resp.json()
    assert isinstance(entries, list) and len(entries) > 0

    ramesh_entry = next((e for e in entries if e.get("customer_name") == "Ramesh"), None)
    assert ramesh_entry is not None, "Could not find Ramesh in Udhari ledger"
    assert float(ramesh_entry.get("amount_due")) == 250.0
    assert ramesh_entry.get("status") in ["UNPAID", "REMINDER_SENT"]
    assert "paytm.me" in ramesh_entry.get("paytm_payment_link", "")

    # Reconcile customer payment via WhatsApp link
    reconcile_payload = {
        "udhari_id": ramesh_entry["id"],
        "utr": "PAYTM_UDHARI_SETTLED_001",
        "amount_paid": 250.0
    }
    rec_resp = api_client.post(f"{BASE_URL}/api/udhari/reconcile", json=reconcile_payload, timeout=8)
    assert rec_resp.status_code == 200, f"Reconciliation failed: {rec_resp.text}"
    rec_body = rec_resp.json()
    assert rec_body.get("success") is True
    print(f"\n[PASS] Flow 1 - Udhari Reconciliation: {rec_body.get('message')}")

    # Re-verify ledger shows SETTLED
    verify_resp = api_client.get(f"{BASE_URL}/api/udhari/list?status=SETTLED", timeout=8)
    assert verify_resp.status_code == 200
    settled_list = verify_resp.json()
    assert any(e["id"] == ramesh_entry["id"] for e in settled_list)
    print(f"[PASS] Flow 1 - Ledger Entry Verified as SETTLED in SQLite database")


# =========================================================================
# FLOW 2: Real-time Mismatch & Spoof Guard
# =========================================================================

def test_05_flow2_mismatch_and_spoof_guard(api_client):
    """
    Flow 2: Expected ₹400 -> Incoming ₹40
    Expected: SHORTFALL_ALERT, deficit ₹360 calculated, regional voice warning 'Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!'
    """
    # 1. Create invoice expecting ₹400 UPI
    create_payload = {
        "total_bill": 400.0,
        "upi_due": 400.0,
        "udhari_amount": 0.0,
        "customer_name": "Potential Fraudster",
        "customer_phone": "9811122233"
    }
    inv_resp = api_client.post(f"{BASE_URL}/api/counter/create-invoice", json=create_payload, timeout=8)
    assert inv_resp.status_code == 200
    invoice_id = inv_resp.json()["invoice_id"]

    # 2. Incoming short payment: ₹40 paid instead of ₹400
    short_payload = {
        "merchant_vpa": "srilakshmi@paytm",
        "utr": "PAYTM_SPOOF_9876",
        "amount": 40.00,
        "status": "SUCCESS",
        "invoice_id": invoice_id
    }
    wb_resp = api_client.post(f"{BASE_URL}/api/paytm/webhook", json=short_payload, timeout=8)
    assert wb_resp.status_code == 200, f"Webhook failed: {wb_resp.text}"
    body = wb_resp.json()

    # 3. Assert Mismatch & Shortfall Status
    assert body.get("status") == "SHORTFALL_ALERT"
    assert body.get("alert_type") == "SHORT_PAYMENT"
    assert float(body.get("amount_received")) == 40.0
    assert float(body.get("amount_expected")) == 400.0

    # 4. Assert Exact Deficit: ₹400 - ₹40 = ₹360
    assert float(body.get("deficit")) == 360.0

    # 5. Assert Regional Hindi Voice Warning
    voice_alert = body.get("voice_alert", "")
    assert "Savdhaan" in voice_alert
    assert "40" in voice_alert
    assert "360" in voice_alert
    assert "baaki" in voice_alert

    # 6. Verify Active Counter Screen Reflects Red Alert SHORT_PAYMENT
    active_resp = api_client.get(f"{BASE_URL}/api/counter/active", timeout=5)
    assert active_resp.status_code == 200
    active_body = active_resp.json()
    assert active_body.get("data", {}).get("status") == "SHORT_PAYMENT"
    assert active_body.get("data", {}).get("deficit") == 360.0

    print(f"\n[PASS] Flow 2 - Real-Time Spoof Guard: Flagged SHORTFALL_ALERT")
    print(f"       Deficit: ₹{body.get('deficit')}")
    print(f"       Voice Alarm: '{voice_alert}'")
    print(f"       Counter Screen Status: {active_body.get('data', {}).get('status')}")


# =========================================================================
# FLOW 3: WhatsApp Snap-to-Restock Agent
# =========================================================================

def test_06_flow3_snap_to_restock_vision_and_price_hike(api_client):
    """
    Flow 3 - Step 1: Invoice Vision OCR & Price Creep Detection (/api/restock/analyze-invoice)
    Expected: Extracted line items (Fortune Sunflower Oil 1L at ₹155), price hike vs history (+10.7%) flagged, draft PO generated
    """
    assert os.path.exists(SAMPLE_INVOICE_PATH), f"Fixture invoice not found at {SAMPLE_INVOICE_PATH}"

    with open(SAMPLE_INVOICE_PATH, "rb") as f:
        files = {"file": ("sample_invoice.png", f, "image/png")}
        resp = requests.post(f"{BASE_URL}/api/restock/analyze-invoice", files=files, timeout=15)

    assert resp.status_code == 200, f"Analyze invoice failed: {resp.text}"
    body = resp.json()
    assert body.get("success") is True

    items = body.get("items", [])
    assert len(items) > 0, "No items returned from invoice analysis"

    # Verify Fortune Sunflower Oil extracted
    fortune_item = next((i for i in items if "Fortune" in i.get("sku", "")), None)
    assert fortune_item is not None, f"Fortune Oil not found in extracted items: {items}"
    assert float(fortune_item.get("unit_rate")) == 155.0

    # Verify Price Hike Detection (>5%, PRD states +10.7% from ₹140 to ₹155)
    price_hikes = body.get("price_hikes", [])
    assert len(price_hikes) > 0, "Expected at least one price hike detected"
    fortune_hike = next((h for h in price_hikes if "Fortune" in h.get("sku", "")), None)
    assert fortune_hike is not None, f"Price hike on Fortune Oil was not detected: {price_hikes}"
    assert fortune_hike.get("price_hike_detected") is True
    assert float(fortune_hike.get("hike_percentage")) == 10.7 or float(fortune_hike.get("hike_percentage")) > 10.0
    assert "WARNING" in fortune_hike.get("warning", "")

    # Verify Draft PO Generated
    draft_po = body.get("draft_po")
    assert draft_po is not None
    assert draft_po.get("po_number") and draft_po.get("po_number").startswith("PO-")
    assert len(draft_po.get("items", [])) > 0

    print(f"\n[PASS] Flow 3 - Snap-to-Restock OCR: Extracted {len(items)} SKUs")
    print(f"       Price Hike Alert: {fortune_hike.get('warning')}")
    print(f"       Draft PO Created: {draft_po.get('po_number')} for {draft_po.get('supplier_name')}")


def test_07_flow3_dispatch_po_to_supplier(api_client):
    """
    Flow 3 - Step 2: 1-Click PO dispatch via WhatsApp (/api/restock/send-po)
    Expected: PO status updated to DISPATCHED_WHATSAPP, WhatsApp preview message generated
    """
    payload = {
        "po_number": "PO-E2E-TEST",
        "supplier_name": "Adani Wilmar Dist.",
        "supplier_phone": "+919840123456",
        "items": [
            {"sku": "Fortune Sunflower Oil 1L", "quantity": 25, "expected_rate": 140.0},
            {"sku": "India Gate Basmati Rice 5kg", "quantity": 15, "expected_rate": 420.0}
        ]
    }
    resp = api_client.post(f"{BASE_URL}/api/restock/send-po", json=payload, timeout=8)
    assert resp.status_code == 200, f"Send PO failed: {resp.text}"
    body = resp.json()

    assert body.get("success") is True
    assert body.get("status") == "DISPATCHED_WHATSAPP"
    assert body.get("po_number") == "PO-E2E-TEST"
    preview = body.get("whatsapp_preview", "")
    assert "Purchase Order" in preview or "PO-E2E-TEST" in preview

    # Verify orders list endpoint (/api/restock/orders)
    orders_resp = api_client.get(f"{BASE_URL}/api/restock/orders", timeout=5)
    assert orders_resp.status_code == 200
    orders_list = orders_resp.json().get("orders", [])
    assert any(o.get("po_number") == "PO-E2E-TEST" for o in orders_list)

    print(f"\n[PASS] Flow 3 - 1-Click PO WhatsApp Dispatch: Status={body.get('status')}")
    print(f"       WhatsApp Message Preview:\n       {preview.replace(chr(10), chr(10)+'       ')}")


# =========================================================================
# SYSTEM SETTINGS & RUNTIME ENGINE CONFIGURATION
# =========================================================================

def test_08_settings_and_runtime_mode(api_client):
    """
    Verify /api/settings endpoint:
    - Reports active zero-setup mock status or live keys
    - Supports dynamic updates of keys and merchant preferences
    """
    resp = api_client.get(f"{BASE_URL}/api/settings", timeout=5)
    assert resp.status_code == 200, f"Settings fetch failed: {resp.text}"
    body = resp.json()

    assert body.get("status") == "success"
    assert body.get("engine_mode") in ["ZERO_SETUP_MOCK", "LIVE_API"]
    assert "keys" in body
    assert "merchant" in body
    assert len(body.get("supported_languages", [])) >= 4

    # Test dynamic update
    update_payload = {
        "merchant_name": "Sri Lakshmi Stores (Verified)",
        "default_language": "hi"
    }
    update_resp = api_client.post(f"{BASE_URL}/api/settings", json=update_payload, timeout=5)
    assert update_resp.status_code == 200
    update_body = update_resp.json()
    assert update_body.get("success") is True
    print(f"\n[PASS] System Settings & Runtime Mode: Mode={body.get('engine_mode')}, Languages={len(body.get('supported_languages'))}")


if __name__ == "__main__":
    pytest.main(["-v", "-s", __file__])
