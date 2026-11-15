from datetime import datetime, timezone
import hashlib
import hmac
import json
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import Transaction, UdhariLedger
from app.schemas import DemoFixtureRequest, WebhookPayload, WebhookResponse
from app.services.tts_service import get_payment_success_audio, get_shortfall_warning_audio
from app.services.sse_manager import sse_manager
from app.services.whatsapp_service import format_udhari_whatsapp_message
from app.routers.counter import active_counter_state
from app.config import settings, paytm_live_ready
from app.services.paytm_gateway import fetch_transaction_status, verify_callback_signature

router = APIRouter(prefix="/paytm", tags=["Paytm Webhook & Spoof Guard"])
_DEMO_FIXTURE_KEY = secrets.token_bytes(32)

def _fixture_signature(event: dict) -> str:
    canonical = json.dumps(event, sort_keys=True, separators=(",", ":")).encode()
    return hmac.new(_DEMO_FIXTURE_KEY, canonical, hashlib.sha256).hexdigest()

def _verify_fixture_signature(event: dict, signature: str) -> bool:
    return hmac.compare_digest(_fixture_signature(event), signature)

@router.post("/demo-fixture", response_model=WebhookResponse)
async def replay_demo_fixture(request: DemoFixtureRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate a fixed, server-side signed fixture to exercise reconciliation.
    This local adapter is not a Paytm signature and does not prove money moved.
    """
    if paytm_live_ready():
        raise HTTPException(status_code=409, detail="Local fixture replay is disabled while Paytm credentials are configured")
    txn = await db.scalar(select(Transaction).where(Transaction.invoice_id == request.invoice_id))
    if not txn:
        raise HTTPException(status_code=404, detail="Fixture invoice was not found")
    if txn.payment_mode == "PAYTM_DYNAMIC_QR":
        raise HTTPException(status_code=409, detail="A live Paytm invoice cannot use a local fixture")
    if txn.status not in {"PENDING_PAYMENT", "SHORT_PAYMENT"}:
        raise HTTPException(status_code=409, detail="This invoice is already settled")

    amount = float(txn.upi_due) if request.scenario == "exact_match" else min(40.0, max(0.01, float(txn.upi_due) / 2))
    event = {
        "invoice_id": txn.invoice_id,
        "scenario": request.scenario,
        "amount": round(amount, 2),
        "utr": f"FIXTURE-{secrets.token_hex(8).upper()}",
    }
    signature = _fixture_signature(event)
    if not _verify_fixture_signature(event, signature):
        raise HTTPException(status_code=401, detail="Local fixture signature validation failed")
    payload = WebhookPayload(invoice_id=event["invoice_id"], amount=event["amount"], utr=event["utr"])
    return await _process_payment_event(payload, db)


async def _process_payment_event(payload: WebhookPayload, db: AsyncSession):
    import app.routers.counter as counter_module

    # 1. Identify the invoice to reconcile
    txn = None
    if payload.invoice_id:
        stmt = select(Transaction).where(Transaction.invoice_id == payload.invoice_id)
        result = await db.execute(stmt)
        txn = result.scalars().first()
    
    if not txn:
        # Match with latest pending transaction or active counter
        if counter_module.active_counter_state and counter_module.active_counter_state.get("status") == "PENDING_PAYMENT":
            active_id = counter_module.active_counter_state.get("invoice_id")
            stmt = select(Transaction).where(Transaction.invoice_id == active_id)
            result = await db.execute(stmt)
            txn = result.scalars().first()
        else:
            stmt = select(Transaction).where(Transaction.status == "PENDING_PAYMENT").order_by(desc(Transaction.created_at))
            result = await db.execute(stmt)
            txn = result.scalars().first()

    if not txn:
        # Fallback dummy invoice for unattached payments
        expected_amount = payload.amount
        invoice_id = payload.invoice_id or "INV-COUNTER"
    else:
        expected_amount = txn.upi_due
        invoice_id = txn.invoice_id

    # Paytm retries S2S notifications. Do not replay the merchant alarm/chime
    # or process the same bank reference twice.
    if txn and payload.utr and txn.utr == payload.utr and txn.status in {"COMPLETED", "SHORT_PAYMENT"}:
        paid = float(txn.upi_received or 0)
        is_match = txn.status == "COMPLETED"
        deficit = max(0.0, round(expected_amount - paid, 2))
        return WebhookResponse(
            status="SUCCESS" if is_match else "SHORTFALL_ALERT",
            alert_type="PAYMENT_SUCCESS" if is_match else "SHORT_PAYMENT",
            invoice_id=invoice_id,
            amount_received=paid,
            amount_expected=expected_amount,
            deficit=0 if is_match else deficit,
            message="Duplicate Paytm notification acknowledged" if is_match else f"Payment mismatch remains: ₹{deficit:.2f} due",
            voice_alert="Payment already verified" if is_match else f"Savdhaan! ₹{deficit:.2f} baaki hai!",
        )

    # The caller supplies either fields verified from Paytm's signed status API,
    # or a server-generated local fixture. Only an exact amount closes the bill.
    if abs(payload.amount - expected_amount) < 0.005:
        # Full payment success
        if txn:
            txn.status = "COMPLETED"
            txn.upi_received = payload.amount
            txn.utr = payload.utr
            txn.completed_at = datetime.now(timezone.utc)
            await db.commit()

        voice_text, b64_audio, audio_url = get_payment_success_audio(payload.amount)

        # Check if customer udhari was associated
        whatsapp_action = None
        if txn and txn.udhari_amount > 0 and txn.customer_name:
            stmt_udh = select(UdhariLedger).where(UdhariLedger.transaction_id == txn.id)
            udh_res = await db.execute(stmt_udh)
            udh_record = udh_res.scalars().first()
            if udh_record:
                whatsapp_action = format_udhari_whatsapp_message(
                    customer_name=udh_record.customer_name,
                    amount=udh_record.amount_due,
                    due_date=udh_record.due_date,
                    payment_link=udh_record.paytm_payment_link
                )

        event_data = {
            "status": "COMPLETED",
            "invoice_id": invoice_id,
            "utr": payload.utr,
            "amount_paid": payload.amount,
            "expected_amount": expected_amount,
            "voice_alert": voice_text,
            "audio_url": audio_url,
            "whatsapp_action": whatsapp_action
        }

        if counter_module.active_counter_state and counter_module.active_counter_state.get("invoice_id") == invoice_id:
            counter_module.active_counter_state["status"] = "COMPLETED"
            counter_module.active_counter_state["utr"] = payload.utr

        # Broadcast real-time SUCCESS to dual-screen clients
        await sse_manager.broadcast("PAYMENT_SUCCESS", event_data)

        return WebhookResponse(
            status="SUCCESS",
            alert_type="PAYMENT_SUCCESS",
            invoice_id=invoice_id,
            amount_received=payload.amount,
            amount_expected=expected_amount,
            deficit=0.0,
            message="Payment verified successfully",
            voice_alert=voice_text,
            audio_base64=b64_audio,
            audio_url=audio_url,
            whatsapp_action=whatsapp_action
        )
    else:
        # Short payment detected!
        deficit = max(0.0, round(expected_amount - payload.amount, 2))
        if txn:
            txn.status = "SHORT_PAYMENT"
            txn.upi_received = payload.amount
            txn.utr = payload.utr
            await db.commit()

        voice_text, b64_audio, audio_url = get_shortfall_warning_audio(payload.amount, deficit)

        event_data = {
            "status": "SHORT_PAYMENT",
            "invoice_id": invoice_id,
            "utr": payload.utr,
            "amount_paid": payload.amount,
            "expected_amount": expected_amount,
            "deficit": deficit,
            "voice_alert": voice_text,
            "audio_url": audio_url,
            "warning": f"SHORT PAYMENT: Expected ₹{expected_amount}, Paid ₹{payload.amount}"
        }

        if counter_module.active_counter_state and counter_module.active_counter_state.get("invoice_id") == invoice_id:
            counter_module.active_counter_state["status"] = "SHORT_PAYMENT"
            counter_module.active_counter_state["deficit"] = deficit

        # Broadcast real-time RED SCREEN SIREN ALERT to dual-screen clients
        await sse_manager.broadcast("SHORTFALL_ALERT", event_data)

        return WebhookResponse(
            status="SHORTFALL_ALERT",
            alert_type="SHORT_PAYMENT",
            invoice_id=invoice_id,
            amount_received=payload.amount,
            amount_expected=expected_amount,
            deficit=deficit,
            message=f"SHORT PAYMENT DETECTED: Expected ₹{int(expected_amount)}, Paid ₹{int(payload.amount)}. Shortfall: ₹{int(deficit)}",
            voice_alert=voice_text,
            audio_base64=b64_audio,
            audio_url=audio_url
        )


@router.post("/webhook")
async def paytm_webhook_receiver(request: Request, db: AsyncSession = Depends(get_db)):
    """Verify a live callback, or run the explicit local JSON adapter without keys."""
    content_type = request.headers.get("content-type", "").lower()
    if not paytm_live_ready():
        if "application/json" not in content_type:
            raise HTTPException(
                status_code=503,
                detail="Paytm callback verification is not configured; use /demo-fixture for a local test",
            )
        try:
            payload = WebhookPayload.model_validate(await request.json())
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid local demo webhook: {exc}") from exc
        if not payload.invoice_id:
            raise HTTPException(status_code=422, detail="Local demo webhook requires invoice_id")
        txn = await db.scalar(select(Transaction).where(Transaction.invoice_id == payload.invoice_id))
        if not txn:
            raise HTTPException(status_code=404, detail="Demo invoice was not found")
        if txn.payment_mode != "DEMO":
            raise HTTPException(status_code=409, detail="Live Paytm invoices require a signed callback")
        return await _process_payment_event(payload, db)

    fields = {str(key): str(value) for key, value in (await request.form()).items()}
    if not verify_callback_signature(fields):
        raise HTTPException(status_code=401, detail="Invalid Paytm callback checksum")

    order_id = fields.get("ORDERID") or fields.get("orderId")
    callback_mid = fields.get("MID") or fields.get("mid")
    if not order_id or callback_mid != settings.PAYTM_MID:
        raise HTTPException(status_code=400, detail="Callback merchant or order does not match")
    txn = await db.scalar(select(Transaction).where(Transaction.invoice_id == order_id))
    if not txn:
        raise HTTPException(status_code=404, detail="Paytm callback order was not found")
    if txn.payment_mode != "PAYTM_DYNAMIC_QR":
        raise HTTPException(status_code=409, detail="Callback does not belong to a Paytm Dynamic QR order")

    try:
        verified = await fetch_transaction_status(order_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Paytm status confirmation failed: {exc}") from exc
    verified_order = verified.get("orderId") or verified.get("ORDERID")
    verified_mid = verified.get("mid") or verified.get("MID")
    verified_status = verified.get("resultInfo", {}).get("resultStatus") or verified.get("resultStatus")
    verified_amount = verified.get("txnAmount") or verified.get("TXNAMOUNT")
    if verified_order != order_id or verified_mid != settings.PAYTM_MID:
        raise HTTPException(status_code=502, detail="Paytm status response did not match this merchant order")
    if verified_status != "TXN_SUCCESS":
        return {"status": verified_status or "PENDING", "order_id": order_id, "verification_source": "PAYTM_TRANSACTION_STATUS"}
    if verified_amount is None:
        raise HTTPException(status_code=502, detail="Paytm success response did not include a transaction amount")

    # Route verified gateway fields through the shared reconciliation/announcement logic.
    verified_payload = WebhookPayload(
        merchant_vpa=settings.DEFAULT_MERCHANT_VPA,
        utr=str(verified.get("bankTxnId") or verified.get("BANKTXNID") or verified.get("txnId") or verified.get("TXNID") or ""),
        amount=float(verified_amount),
        status=verified_status,
        invoice_id=order_id,
    )
    return await _process_payment_event(verified_payload, db)
