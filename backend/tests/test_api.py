import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_db()

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "Sri Lakshmi Stores" in data["merchant"]

@pytest.mark.asyncio
async def test_voice_parse_split():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "transcript_text": "Customer bill 650, 400 UPI now, 250 udhari for Monday, Ramesh 9876543210"
        }
        resp = await client.post("/api/voice/parse", json=payload)
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is True
        assert result["latency_ms"] < 600.0  # Ultra-low latency guarantee

        data = result["data"]
        assert data["total_bill"] == 650.0
        assert data["upi_amount"] == 400.0
        assert data["udhari_amount"] == 250.0
        assert data["customer_name"] == "Ramesh"
        assert data["customer_phone"] == "9876543210"
        assert data["due_date"] is not None

@pytest.mark.asyncio
async def test_voice_parse_presets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Full UPI preset
        resp = await client.post("/api/voice/parse", json={"transcript_text": "₹200 Full UPI"})
        data = resp.json()["data"]
        assert data["total_bill"] == 200.0
        assert data["upi_amount"] == 200.0
        assert data["udhari_amount"] == 0.0

        # Split with cash preset
        resp2 = await client.post("/api/voice/parse", json={"transcript_text": "₹1200 split with ₹500 cash"})
        data2 = resp2.json()["data"]
        assert data2["total_bill"] == 1200.0
        assert data2["cash_amount"] == 500.0
        assert data2["upi_amount"] == 700.0

@pytest.mark.asyncio
async def test_counter_create_invoice_and_active():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        inv_payload = {
            "total_bill": 650.0,
            "upi_due": 400.0,
            "udhari_amount": 250.0,
            "customer_name": "Ramesh",
            "customer_phone": "9876543210",
            "due_date": "2026-11-17"
        }
        resp = await client.post("/api/counter/create-invoice", json=inv_payload)
        assert resp.status_code == 200
        inv_data = resp.json()
        assert inv_data["success"] is True
        assert inv_data["invoice_id"].startswith("INV-")
        assert "upi://pay?" in inv_data["qr_data"]
        assert "am=400.00" in inv_data["qr_data"]
        assert inv_data["qr_code_url"].startswith("data:image/png;base64,")
        assert inv_data["udhari_id"] is not None

        # Verify active endpoint reflects this invoice
        active_resp = await client.get("/api/counter/active")
        assert active_resp.status_code == 200
        active_data = active_resp.json()
        assert active_data["active"] is True
        assert active_data["data"]["invoice_id"] == inv_data["invoice_id"]

@pytest.mark.asyncio
async def test_paytm_webhook_full_payment():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create invoice of 400 UPI
        inv_payload = {
            "total_bill": 400.0,
            "upi_due": 400.0,
            "customer_name": "Ramesh",
            "customer_phone": "9876543210"
        }
        inv_resp = await client.post("/api/counter/create-invoice", json=inv_payload)
        invoice_id = inv_resp.json()["invoice_id"]

        # Trigger full payment webhook
        wh_payload = {
            "merchant_vpa": "srilakshmi@paytm",
            "utr": "PAYTM992817361",
            "amount": 400.0,
            "status": "SUCCESS",
            "invoice_id": invoice_id
        }
        resp = await client.post("/api/paytm/webhook", json=wh_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SUCCESS"
        assert data["alert_type"] == "PAYMENT_SUCCESS"
        assert data["amount_received"] == 400.0
        assert "Paytm par ₹400 prapt hue" in data["voice_alert"]
        assert data["audio_base64"] is not None

@pytest.mark.asyncio
async def test_paytm_webhook_shortfall_mismatch():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create invoice of 400 UPI
        inv_payload = {
            "total_bill": 400.0,
            "upi_due": 400.0,
            "customer_name": "FraudTest"
        }
        inv_resp = await client.post("/api/counter/create-invoice", json=inv_payload)
        invoice_id = inv_resp.json()["invoice_id"]

        # Trigger short payment webhook (customer paid only 40 instead of 400)
        wh_payload = {
            "merchant_vpa": "srilakshmi@paytm",
            "utr": "SPOOF40PAYTM",
            "amount": 40.0,
            "status": "SUCCESS",
            "invoice_id": invoice_id
        }
        resp = await client.post("/api/paytm/webhook", json=wh_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "SHORTFALL_ALERT"
        assert data["alert_type"] == "SHORT_PAYMENT"
        assert data["amount_received"] == 40.0
        assert data["amount_expected"] == 400.0
        assert data["deficit"] == 360.0
        assert "Savdhaan! Keval ₹40 prapt hue hain! ₹360 baaki hai!" in data["voice_alert"]
        assert data["audio_base64"] is not None

@pytest.mark.asyncio
async def test_udhari_reconcile_validates_amount_and_duplicate_settlement():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post(
            "/api/udhari/create",
            json={
                "customer_name": "Validation Customer",
                "customer_phone": "9876543210",
                "amount_due": 125.0,
                "due_date": "2026-11-20",
            },
        )
        assert create_resp.status_code == 200
        udhari_id = create_resp.json()["id"]

        partial_resp = await client.post(
            "/api/udhari/reconcile",
            json={"udhari_id": udhari_id, "utr": "PARTIAL", "amount_paid": 100.0},
        )
        assert partial_resp.status_code == 422

        settle_resp = await client.post(
            "/api/udhari/reconcile",
            json={"udhari_id": udhari_id, "utr": "EXACT", "amount_paid": 125.0},
        )
        assert settle_resp.status_code == 200

        duplicate_resp = await client.post(
            "/api/udhari/reconcile",
            json={"udhari_id": udhari_id, "utr": "EXACT", "amount_paid": 125.0},
        )
        assert duplicate_resp.status_code == 409

@pytest.mark.asyncio
async def test_udhari_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List Udhari
        resp = await client.get("/api/udhari/list")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 3

        # Pick first unpaid entry
        unpaid = next((x for x in items if x["status"] == "UNPAID"), items[0])
        udhari_id = unpaid["id"]

        # 2. Send WhatsApp Reminder
        rem_resp = await client.post("/api/udhari/send-reminder", json={"udhari_id": udhari_id})
        assert rem_resp.status_code == 200
        rem_data = rem_resp.json()
        assert rem_data["success"] is True
        assert "p.paytm.me" in rem_data["whatsapp_payload"]["actions"][0]["url"]

        # 3. Reconcile Payment
        rec_payload = {
            "udhari_id": udhari_id,
            "utr": "PAYTM_UDH_RECON_123",
            "amount_paid": unpaid["amount_due"]
        }
        rec_resp = await client.post("/api/udhari/reconcile", json=rec_payload)
        assert rec_resp.status_code == 200
        assert rec_resp.json()["success"] is True

@pytest.mark.asyncio
async def test_restock_analyzer_and_price_hike():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Analyze invoice
        resp = await client.post("/api/restock/analyze-invoice")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["analysis_source"] == "LOCAL_FIXTURE"
        assert "no external OCR" in data["validation_note"]
        assert len(data["items"]) >= 3

        # Verify price hike detection on Fortune Sunflower Oil (155 vs 140 historical = +10.7%)
        hikes = data["price_hikes"]
        assert len(hikes) >= 1
        oil_hike = next(h for h in hikes if "Fortune" in h["sku"])
        assert oil_hike["price_hike_detected"] is True
        assert oil_hike["unit_rate"] == 155.0
        assert oil_hike["previous_rate"] == 140.0
        assert oil_hike["hike_amount"] == 15.0
        assert oil_hike["hike_percentage"] == 10.7
        assert "increased by ₹15" in oil_hike["warning"]

        # Verify draft PO
        po = data["draft_po"]
        assert po["supplier_name"] == data["vendor_name"]
        assert len(po["items"]) >= 2

        # Send PO
        po_payload = {
            "po_number": po["po_number"],
            "supplier_name": po["supplier_name"],
            "supplier_phone": po["supplier_phone"],
            "items": po["items"]
        }
        send_resp = await client.post("/api/restock/send-po", json=po_payload)
        assert send_resp.status_code == 200
        send_data = send_resp.json()
        assert send_data["success"] is True
        assert send_data["status"] == "DISPATCHED_WHATSAPP"
        assert "PURCHASE ORDER" in send_data["whatsapp_preview"]


@pytest.mark.asyncio
async def test_counter_reset():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create an invoice
        inv_payload = {"total_bill": 100.0, "upi_due": 100.0}
        await client.post("/api/counter/create-invoice", json=inv_payload)
        
        # Reset
        reset_resp = await client.post("/api/counter/reset")
        assert reset_resp.status_code == 200
        
        # Check active is False
        active_resp = await client.get("/api/counter/active")
        assert active_resp.json()["active"] is False

@pytest.mark.asyncio
async def test_hindi_udhari_voice_command():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "transcript_text": "Ramesh ka 250 udhari likho somwar tak phone 9876543210"
        }
        resp = await client.post("/api/voice/parse", json=payload)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["udhari_amount"] == 250.0
        assert data["customer_name"] == "Ramesh"
        assert data["customer_phone"] == "9876543210"
        assert data["due_date"] is not None

@pytest.mark.asyncio
async def test_restock_price_history_and_orders():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        hist_resp = await client.get("/api/restock/price-history")
        assert hist_resp.status_code == 200
        records = hist_resp.json()["sku_records"]
        assert len(records) >= 5

        orders_resp = await client.get("/api/restock/orders")
        assert orders_resp.status_code == 200
        assert "orders" in orders_resp.json()


@pytest.mark.asyncio
async def test_settings_get_and_update():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET settings
        resp = await client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "engine_mode" in data
        assert "keys" in data
        assert "sarvam_api_key" in data["keys"]
        assert "merchant" in data

        # POST update keys
        update_payload = {
            "sarvam_api_key": "sarvam_secret_key_12345",
            "merchant_name": "Aura Kirana Store",
            "merchant_vpa": "aurakirana@paytm"
        }
        post_resp = await client.post("/api/settings", json=update_payload)
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        assert post_data["success"] is True
        assert post_data["updated_keys"]["sarvam_configured"] is True
        assert post_data["updated_keys"]["merchant_name"] == "Aura Kirana Store"

        # Verify masked key in subsequent GET
        get_resp2 = await client.get("/api/settings")
        data2 = get_resp2.json()
        sarvam_info = data2["keys"]["sarvam_api_key"]
        assert sarvam_info["is_configured"] is True
        assert sarvam_info["masked"].startswith("sar")
        assert sarvam_info["masked"].endswith("2345")
        assert "secret" not in sarvam_info["masked"]
