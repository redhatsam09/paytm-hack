import uuid
import random
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import Transaction, UdhariLedger
from app.schemas import CreateInvoiceRequest, InvoiceResponse
from app.services.qr_service import generate_paytm_upi_string, generate_qr_base64
from app.services.sse_manager import sse_manager
from app.services.whatsapp_service import create_paytm_payment_link
from app.config import settings
from app.config import paytm_live_ready

try:
    from app.services.paytm_gateway import create_dynamic_qr, fetch_transaction_status
except ImportError:  # Keeps the app importable before backend requirements are installed.
    create_dynamic_qr = None
    fetch_transaction_status = None

router = APIRouter(prefix="/counter", tags=["Counter & Dynamic QR"])

# Shared in-memory active transaction state for fast dual-screen sync
active_counter_state: Optional[dict] = None

@router.post("/create-invoice", response_model=InvoiceResponse)
async def create_invoice(request: CreateInvoiceRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate dynamic amount-locked Paytm QR code, save transaction,
    optionally draft Udhari record, and broadcast to customer screen.
    """
    global active_counter_state

    # Generate collision-free unique invoice ID
    invoice_id = f"INV-{uuid.uuid4().hex[:6].upper()}"
    payment_mode = "DEMO"
    if paytm_live_ready():
        if create_dynamic_qr is None:
            raise HTTPException(status_code=503, detail="Install backend payment dependencies to use Paytm Dynamic QR")
        try:
            gateway_qr = await create_dynamic_qr(
                order_id=invoice_id,
                amount=request.upi_due,
                phone=request.customer_phone,
            )
            upi_string = gateway_qr["qr_data"]
            payment_mode = "PAYTM_DYNAMIC_QR"
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Paytm QR creation failed: {exc}") from exc
    else:
        upi_string = generate_paytm_upi_string(
            amount=request.upi_due,
            invoice_id=invoice_id,
            merchant_vpa="demo-not-a-real-vpa.invalid",
            merchant_name="DEMO ONLY - NO PAYMENT"
        )
    qr_base64 = generate_qr_base64(upi_string)

    # Save transaction record in DB
    txn = Transaction(
        id=str(uuid.uuid4()),
        invoice_id=invoice_id,
        total_bill=request.total_bill,
        upi_due=request.upi_due,
        upi_received=0.0,
        cash_received=request.cash_received,
        udhari_amount=request.udhari_amount,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        due_date=request.due_date,
        items_summary=request.items_summary,
        status="PENDING_PAYMENT",
        qr_data=upi_string,
        qr_code_url=qr_base64,
        payment_mode=payment_mode,
    )
    db.add(txn)

    udhari_id = None
    if request.udhari_amount > 0 and request.customer_name:
        link_url, link_id = create_paytm_payment_link(request.udhari_amount)
        due = request.due_date or "Next Week"
        phone = request.customer_phone or "9876543210"

        udhari = UdhariLedger(
            id=str(uuid.uuid4()),
            transaction_id=txn.id,
            customer_name=request.customer_name,
            customer_phone=phone,
            amount_due=request.udhari_amount,
            due_date=due,
            status="UNPAID",
            paytm_payment_link=link_url,
            payment_link_id=link_id
        )
        db.add(udhari)
        udhari_id = udhari.id

    await db.commit()
    await db.refresh(txn)

    response_data = {
        "success": True,
        "invoice_id": invoice_id,
        "total_bill": request.total_bill,
        "upi_due": request.upi_due,
        "udhari_amount": request.udhari_amount,
        "cash_received": request.cash_received,
        "customer_name": request.customer_name,
        "customer_phone": request.customer_phone,
        "due_date": request.due_date,
        "qr_data": upi_string,
        "qr_code_url": qr_base64,
        "amount": request.upi_due,
        "expires_in": settings.QR_EXPIRY_SECONDS,
        "status": "PENDING_PAYMENT",
        "udhari_id": udhari_id,
        "payment_mode": payment_mode,
    }

    # Store active state
    active_counter_state = response_data.copy()

    # Broadcast event to Customer Display and Merchant screens
    await sse_manager.broadcast("INVOICE_CREATED", response_data)

    return InvoiceResponse(**response_data)

@router.get("/active")
async def get_active_invoice():
    """Return currently active counter transaction for screen synchronization."""
    global active_counter_state
    if not active_counter_state:
        return {"active": False, "data": None}
    return {"active": True, "data": active_counter_state}

@router.get("/status/{invoice_id}")
async def check_paytm_status(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Ask Paytm's server for the final status of a real Dynamic QR order."""
    if not paytm_live_ready() or fetch_transaction_status is None:
        raise HTTPException(status_code=409, detail="Paytm live verification is not configured; this invoice is demo-only")
    txn = await db.scalar(select(Transaction).where(Transaction.invoice_id == invoice_id))
    if not txn:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if txn.payment_mode != "PAYTM_DYNAMIC_QR":
        raise HTTPException(status_code=409, detail="This invoice used the demo QR, not Paytm Dynamic QR")
    try:
        gateway = await fetch_transaction_status(invoice_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Paytm status check failed: {exc}") from exc

    status = gateway.get("resultInfo", {}).get("resultStatus") or gateway.get("resultStatus")
    amount = gateway.get("txnAmount") or gateway.get("TXNAMOUNT")
    gateway_mid = gateway.get("mid") or gateway.get("MID")
    gateway_order = gateway.get("orderId") or gateway.get("ORDERID")
    if gateway_order != invoice_id or gateway_mid != settings.PAYTM_MID:
        raise HTTPException(status_code=502, detail="Paytm status response did not match this merchant order")
    if status == "TXN_SUCCESS" and amount is not None:
        paid = float(amount)
        txn.upi_received = paid
        txn.utr = gateway.get("bankTxnId") or gateway.get("BANKTXNID") or gateway.get("txnId") or gateway.get("TXNID")
        txn.status = "COMPLETED" if abs(paid - txn.upi_due) < 0.005 else "SHORT_PAYMENT"
        txn.completed_at = datetime.now(timezone.utc) if txn.status == "COMPLETED" else None
        await db.commit()
        return {"status": txn.status, "amount_received": paid, "amount_expected": txn.upi_due, "deficit": max(0, round(txn.upi_due - paid, 2)), "utr": txn.utr, "verification_source": "PAYTM_TRANSACTION_STATUS"}
    return {"status": status or "PENDING", "amount_received": float(amount or 0), "amount_expected": txn.upi_due, "verification_source": "PAYTM_TRANSACTION_STATUS"}

@router.post("/reset")
async def reset_counter():
    """Reset counter to idle standby mode."""
    global active_counter_state
    active_counter_state = None
    await sse_manager.broadcast("COUNTER_RESET", {"status": "IDLE"})
    return {"success": True, "message": "Counter reset to idle"}

@router.get("/history")
async def get_counter_history(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """Retrieve history of recent counter transactions."""
    stmt = select(Transaction).order_by(desc(Transaction.created_at)).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return {
        "transactions": [
            {
                "id": r.id,
                "invoice_id": r.invoice_id,
                "total_bill": r.total_bill,
                "upi_due": r.upi_due,
                "upi_received": r.upi_received,
                "udhari_amount": r.udhari_amount,
                "status": r.status,
                "payment_mode": r.payment_mode,
                "utr": r.utr,
                "customer_name": r.customer_name,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None
            }
            for r in records
        ]
    }
