import uuid
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import UdhariLedger
from app.schemas import (
    UdhariItem,
    UdhariCreateRequest,
    UdhariReminderRequest,
    UdhariReminderResponse,
    UdhariReconcileRequest,
    UdhariReconcileResponse,
    DemoUdhariFixtureRequest,
)
from app.config import paytm_live_ready
from app.services.whatsapp_service import (
    create_paytm_payment_link,
    format_udhari_whatsapp_message
)
from app.services.sse_manager import sse_manager

router = APIRouter(prefix="/udhari", tags=["WhatsApp & Udhari Ledger"])
_DEMO_UDHARI_KEY = secrets.token_bytes(32)

def _udhari_fixture_signature(event: dict) -> str:
    canonical = json.dumps(event, sort_keys=True, separators=(",", ":")).encode()
    return hmac.new(_DEMO_UDHARI_KEY, canonical, hashlib.sha256).hexdigest()

def _verify_udhari_fixture(event: dict, signature: str) -> bool:
    return hmac.compare_digest(_udhari_fixture_signature(event), signature)

@router.get("/list", response_model=List[UdhariItem])
async def list_udhari_entries(status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """
    Fetch all Udhari ledger accounts (Unpaid, Reminder Sent, Settled).
    """
    stmt = select(UdhariLedger).order_by(desc(UdhariLedger.created_at))
    if status:
        stmt = stmt.where(UdhariLedger.status == status.upper())
    result = await db.execute(stmt)
    records = result.scalars().all()

    return [
        UdhariItem(
            id=r.id,
            transaction_id=r.transaction_id,
            customer_name=r.customer_name,
            customer_phone=r.customer_phone,
            amount_due=r.amount_due,
            due_date=r.due_date,
            status=r.status,
            paytm_payment_link=r.paytm_payment_link,
            payment_link_id=r.payment_link_id,
            created_at=r.created_at.isoformat() if r.created_at else None,
            settled_at=r.settled_at.isoformat() if r.settled_at else None
        )
        for r in records
    ]

@router.post("/create", response_model=UdhariItem)
async def create_udhari_entry(request: UdhariCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Directly create or log an Udhari entry.
    """
    link_url, link_id = create_paytm_payment_link(request.amount_due)

    udhari = UdhariLedger(
        id=str(uuid.uuid4()),
        transaction_id=request.transaction_id,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        amount_due=request.amount_due,
        due_date=request.due_date,
        status="UNPAID",
        paytm_payment_link=link_url,
        payment_link_id=link_id
    )
    db.add(udhari)
    await db.commit()
    await db.refresh(udhari)

    # Broadcast event
    await sse_manager.broadcast("UDHARI_CREATED", {
        "id": udhari.id,
        "customer_name": udhari.customer_name,
        "amount_due": udhari.amount_due
    })

    return UdhariItem(
        id=udhari.id,
        transaction_id=udhari.transaction_id,
        customer_name=udhari.customer_name,
        customer_phone=udhari.customer_phone,
        amount_due=udhari.amount_due,
        due_date=udhari.due_date,
        status=udhari.status,
        paytm_payment_link=udhari.paytm_payment_link,
        payment_link_id=udhari.payment_link_id,
        created_at=udhari.created_at.isoformat() if udhari.created_at else None,
        settled_at=None
    )

@router.post("/send-reminder", response_model=UdhariReminderResponse)
async def send_whatsapp_reminder(request: UdhariReminderRequest, db: AsyncSession = Depends(get_db)):
    """
    Dispatches automated WhatsApp payment reminder with instant Paytm UPI link.
    """
    stmt = select(UdhariLedger).where(UdhariLedger.id == request.udhari_id)
    result = await db.execute(stmt)
    udhari = result.scalars().first()

    if not udhari:
        raise HTTPException(status_code=404, detail="Udhari ledger entry not found")

    whatsapp_payload = format_udhari_whatsapp_message(
        customer_name=udhari.customer_name,
        amount=udhari.amount_due,
        due_date=udhari.due_date,
        payment_link=udhari.paytm_payment_link
    )

    await sse_manager.broadcast("UDHARI_REMINDER_PREPARED", {
        "udhari_id": udhari.id,
        "customer_name": udhari.customer_name,
        "whatsapp_payload": whatsapp_payload
    })

    return UdhariReminderResponse(
        success=True,
        message=f"WhatsApp reminder prepared for {udhari.customer_name}; merchant must send it from WhatsApp",
        whatsapp_payload=whatsapp_payload
    )

@router.post("/reconcile", response_model=UdhariReconcileResponse)
async def reconcile_udhari_payment(request: UdhariReconcileRequest, db: AsyncSession = Depends(get_db)):
    """
    Local-only demo reconciliation using a supplied amount. Live Paytm mode rejects it;
    the WhatsApp link does not currently deliver a verified provider callback here.
    """
    if paytm_live_ready():
        raise HTTPException(status_code=409, detail="Client-supplied settlement is disabled in Paytm live mode")
    stmt = select(UdhariLedger).where(
        (UdhariLedger.id == request.udhari_id) | (UdhariLedger.payment_link_id == request.udhari_id)
    )
    result = await db.execute(stmt)
    udhari = result.scalars().first()

    if not udhari:
        raise HTTPException(status_code=404, detail="Udhari record not found")
    if udhari.status == "SETTLED":
        raise HTTPException(status_code=409, detail="Udhari record is already settled")
    if abs(float(request.amount_paid) - float(udhari.amount_due)) > 0.005:
        raise HTTPException(
            status_code=422,
            detail=f"Settlement amount must match the outstanding balance of ₹{udhari.amount_due:.2f}",
        )

    now = datetime.now(timezone.utc)
    udhari.status = "SETTLED"
    udhari.settled_at = now
    await db.commit()

    settled_record = {
        "id": udhari.id,
        "customer_name": udhari.customer_name,
        "amount_settled": request.amount_paid,
        "utr": request.utr,
        "settled_at": now.isoformat()
    }

    # Broadcast real-time ledger settlement
    await sse_manager.broadcast("UDHARI_SETTLED", settled_record)

    return UdhariReconcileResponse(
        success=True,
        message=f"Local demo reconciliation recorded for ₹{request.amount_paid} on {udhari.customer_name}'s store-credit entry",
        settled_record=settled_record
    )


@router.post("/demo-settlement-fixture", response_model=UdhariReconcileResponse)
async def replay_demo_udhari_fixture(request: DemoUdhariFixtureRequest, db: AsyncSession = Depends(get_db)):
    """Record an exact, server-signed local settlement fixture without a client amount."""
    if paytm_live_ready():
        raise HTTPException(status_code=409, detail="Local settlement fixtures are disabled in Paytm live mode")
    udhari = await db.scalar(select(UdhariLedger).where(UdhariLedger.id == request.udhari_id))
    if not udhari:
        raise HTTPException(status_code=404, detail="Udhari record not found")
    if udhari.status == "SETTLED":
        raise HTTPException(status_code=409, detail="Udhari record is already settled")

    event = {
        "udhari_id": udhari.id,
        "amount": round(float(udhari.amount_due), 2),
        "utr": f"FIXTURE-{secrets.token_hex(8).upper()}",
    }
    signature = _udhari_fixture_signature(event)
    if not _verify_udhari_fixture(event, signature):
        raise HTTPException(status_code=401, detail="Local settlement fixture signature validation failed")

    now = datetime.now(timezone.utc)
    udhari.status = "SETTLED"
    udhari.settled_at = now
    await db.commit()
    settled_record = {
        "id": udhari.id,
        "customer_name": udhari.customer_name,
        "amount_settled": event["amount"],
        "utr": event["utr"],
        "settled_at": now.isoformat(),
    }
    await sse_manager.broadcast("UDHARI_SETTLED", settled_record)
    return UdhariReconcileResponse(
        success=True,
        message=f"Local demo fixture reconciled ₹{event['amount']:.2f} for {udhari.customer_name}; no payment provider was queried",
        settled_record=settled_record,
    )
