from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import Transaction, UdhariLedger
from app.schemas import WebhookPayload, WebhookResponse
from app.services.tts_service import get_payment_success_audio, get_shortfall_warning_audio
from app.services.sse_manager import sse_manager
from app.services.whatsapp_service import format_udhari_whatsapp_message
from app.routers.counter import active_counter_state

router = APIRouter(prefix="/paytm", tags=["Paytm Webhook & Spoof Guard"])

@router.post("/webhook", response_model=WebhookResponse)
async def paytm_webhook_receiver(payload: WebhookPayload, db: AsyncSession = Depends(get_db)):
    """
    Real-time Paytm UPI Webhook listener.
    Reconciles incoming UTR against active invoice:
    - Full payment: Announces 'Paytm par ₹400 prapt hue', broadcasts green tick, triggers WhatsApp Udhari link.
    - Short payment / Spoof: Announces 'Savdhaan! Keval ₹40 prapt hue...', flashes red screen alarm.
    """
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

    # 2. Check for Shortfall vs Full Match
    if payload.amount >= expected_amount:
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
        deficit = round(expected_amount - payload.amount, 2)
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
