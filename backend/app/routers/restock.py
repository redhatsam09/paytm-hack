import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models import SkuPriceHistory, RestockOrder
from app.schemas import (
    InvoiceAnalysisResponse,
    SendPORequest,
    RestockOrderResponse
)
from app.services.restock_service import analyze_invoice_image
from app.services.whatsapp_service import format_po_whatsapp_message
from app.services.sse_manager import sse_manager

router = APIRouter(prefix="/restock", tags=["Invoice OCR & Restock Agent"])

@router.post("/analyze-invoice", response_model=InvoiceAnalysisResponse)
async def analyze_invoice(
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Snap-to-Restock Agent:
    Accepts distributor invoice image, runs Gemini Vision OCR / Kirana analyzer,
    compares against past SKU price history to flag hikes, and drafts reorder PO.
    """
    image_bytes = None
    filename = None
    if file:
        image_bytes = await file.read()
        filename = file.filename

    analysis = await analyze_invoice_image(
        image_bytes=image_bytes,
        db_session=db,
        filename=filename
    )

    # Broadcast event so WhatsApp simulator updates in real time
    await sse_manager.broadcast("INVOICE_ANALYZED", {
        "vendor_name": analysis.vendor_name,
        "hikes_count": len(analysis.price_hikes),
        "draft_po": analysis.draft_po.model_dump()
    })

    return analysis

@router.get("/price-history")
async def get_price_history(db: AsyncSession = Depends(get_db)):
    """Fetch historical SKU price logs comparing suppliers and past dates."""
    stmt = select(SkuPriceHistory).order_by(desc(SkuPriceHistory.invoice_date))
    result = await db.execute(stmt)
    records = result.scalars().all()
    return {
        "sku_records": [
            {
                "id": r.id,
                "sku_name": r.sku_name,
                "category": r.category,
                "supplier_name": r.supplier_name,
                "unit_rate": r.unit_rate,
                "invoice_date": r.invoice_date,
                "invoice_image_url": r.invoice_image_url
            }
            for r in records
        ]
    }

@router.post("/send-po", response_model=RestockOrderResponse)
async def send_purchase_order(request: SendPORequest, db: AsyncSession = Depends(get_db)):
    """
    Dispatches drafted purchase order to supplier WhatsApp.
    """
    whatsapp_data = format_po_whatsapp_message(
        po_number=request.po_number,
        supplier_name=request.supplier_name,
        items=request.items
    )

    # Idempotent upsert: update if already exists, else create
    stmt = select(RestockOrder).where(RestockOrder.po_number == request.po_number)
    res = await db.execute(stmt)
    order = res.scalars().first()

    if order:
        order.supplier_name = request.supplier_name
        order.supplier_phone = request.supplier_phone
        order.items = request.items
        order.status = "DISPATCHED_WHATSAPP"
    else:
        order = RestockOrder(
            id=str(uuid.uuid4()),
            po_number=request.po_number,
            supplier_name=request.supplier_name,
            supplier_phone=request.supplier_phone,
            items=request.items,
            status="DISPATCHED_WHATSAPP"
        )
        db.add(order)

    await db.commit()
    await db.refresh(order)

    # Broadcast event
    await sse_manager.broadcast("PO_DISPATCHED", {
        "po_number": order.po_number,
        "supplier": order.supplier_name,
        "whatsapp_preview": whatsapp_data["message"]
    })

    return RestockOrderResponse(
        success=True,
        message=f"Purchase order {order.po_number} successfully dispatched to {order.supplier_name} via WhatsApp",
        po_number=order.po_number,
        status=order.status,
        whatsapp_preview=whatsapp_data["message"]
    )

@router.get("/orders")
async def list_restock_orders(db: AsyncSession = Depends(get_db)):
    """Retrieve all drafted and dispatched wholesale purchase orders."""
    stmt = select(RestockOrder).order_by(desc(RestockOrder.created_at))
    result = await db.execute(stmt)
    records = result.scalars().all()
    return {
        "orders": [
            {
                "id": r.id,
                "po_number": r.po_number,
                "supplier_name": r.supplier_name,
                "supplier_phone": r.supplier_phone,
                "items": r.items,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in records
        ]
    }
