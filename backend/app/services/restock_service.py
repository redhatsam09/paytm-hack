import os
import json
import uuid
import csv
import io
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models import SkuPriceHistory, RestockOrder
from app.schemas import InvoiceItemParsed, DraftPO, InvoiceAnalysisResponse
from app.config import settings

SAMPLE_INVOICE_ITEMS = [
    {
        "sku": "Fortune Sunflower Oil 1L",
        "quantity": 20,
        "unit_rate": 155.0
    },
    {
        "sku": "Tata Salt 1kg",
        "quantity": 50,
        "unit_rate": 28.0
    },
    {
        "sku": "India Gate Basmati Rice 5kg",
        "quantity": 10,
        "unit_rate": 420.0
    }
]

async def analyze_invoice_image(
    image_bytes: Optional[bytes],
    db_session: AsyncSession,
    filename: Optional[str] = None
) -> InvoiceAnalysisResponse:
    """
    Analyze an uploaded CSV or Gemini Vision image/PDF, compare historical
    prices from DB, and draft a PO from the analyzed line items. No-file calls
    explicitly select the local sample fixture.
    """
    vendor_name = "Supplier not detected"
    supplier_phone = ""
    invoice_no = "Not detected"
    invoice_date = "Not detected"
    raw_items = SAMPLE_INVOICE_ITEMS
    analysis_source = "LOCAL_FIXTURE"
    validation_note = "Local fixture data; no external OCR or supplier API was used."
    is_csv_upload = bool(filename and filename.lower().endswith(".csv") and image_bytes)

    if not image_bytes:
        today = datetime.date.today()
        vendor_name = "Adani Wilmar Dist."
        supplier_phone = "+919840123456"
        invoice_no = f"SAMPLE-{today.strftime('%Y%m%d')}"
        invoice_date = today.isoformat()

    if is_csv_upload:
        try:
            reader = csv.DictReader(io.StringIO(image_bytes.decode("utf-8-sig")))
            if not reader.fieldnames:
                raise ValueError("CSV has no header row")
            normalized = {name.strip().lower(): name for name in reader.fieldnames if name}
            if not {"sku", "quantity", "unit_rate"}.issubset(normalized):
                raise ValueError("CSV needs sku, quantity, and unit_rate columns")
            raw_items = []
            for row in reader:
                sku = (row.get(normalized["sku"]) or "").strip()
                quantity = int(row.get(normalized["quantity"]) or 0)
                unit_rate = float(row.get(normalized["unit_rate"]) or 0)
                if not sku or quantity <= 0 or unit_rate <= 0:
                    raise ValueError("Each row needs a SKU and positive quantity and unit_rate")
                raw_items.append({"sku": sku, "quantity": quantity, "unit_rate": unit_rate})
                vendor_name = (row.get(normalized.get("vendor_name", "")) or vendor_name).strip()
                invoice_no = (row.get(normalized.get("invoice_no", "")) or invoice_no).strip()
                invoice_date = (row.get(normalized.get("invoice_date", "")) or invoice_date).strip()
                supplier_phone = (row.get(normalized.get("supplier_phone", "")) or supplier_phone).strip()
            if not raw_items:
                raise ValueError("CSV contains no item rows")
            analysis_source = "CSV_UPLOAD"
            validation_note = "Uploaded CSV rows were audited against stored supplier price history; no AI OCR was used."
        except (UnicodeDecodeError, csv.Error, ValueError) as exc:
            raise RuntimeError(f"Could not read invoice CSV: {exc}") from exc

    # Uploaded files must never be reported as OCR results when only fixture
    # data was analyzed. The no-file path is the explicit local demo fixture.
    if image_bytes and not is_csv_upload and not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is required to analyze an uploaded distributor invoice")

    if image_bytes and not is_csv_upload:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            
            mime_type = "image/jpeg"
            if filename:
                fn_lower = filename.lower()
                if fn_lower.endswith(".png"):
                    mime_type = "image/png"
                elif fn_lower.endswith(".webp"):
                    mime_type = "image/webp"
                elif fn_lower.endswith(".pdf"):
                    mime_type = "application/pdf"

            prompt = """
            You are an expert OCR parser for Indian wholesale Kirana store distributor invoices.
            Analyze this invoice image and extract:
            1. vendor_name (string, name of distributor or wholesaler)
            2. supplier_phone (string or null, phone printed on the invoice)
            3. invoice_no (string)
            4. invoice_date (YYYY-MM-DD)
            5. items: list of objects with "sku" (name of product), "quantity" (integer), and "unit_rate" (float)
            Return strictly valid JSON only without markdown or code blocks.
            """
            
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt
                    ]
                )
            except Exception:
                # Fallback to gemini-2.0-flash if 2.5 is not accessible
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        prompt
                    ]
                )

            clean_resp = response.text.strip()
            if "```json" in clean_resp:
                clean_resp = clean_resp.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_resp:
                clean_resp = clean_resp.split("```")[1].split("```")[0].strip()

            parsed_json = json.loads(clean_resp)
            if "vendor_name" in parsed_json and parsed_json["vendor_name"]:
                vendor_name = parsed_json["vendor_name"]
            if "invoice_no" in parsed_json and parsed_json["invoice_no"]:
                invoice_no = parsed_json["invoice_no"]
            if "invoice_date" in parsed_json and parsed_json["invoice_date"]:
                invoice_date = parsed_json["invoice_date"]
            supplier_phone = str(parsed_json.get("supplier_phone") or "")
            if not isinstance(parsed_json.get("items"), list) or not parsed_json["items"]:
                raise ValueError("OCR response did not contain invoice line items")
            raw_items = parsed_json["items"]
            analysis_source = "GEMINI_VISION"
            validation_note = "OCR output was normalized and checked against stored SKU price history."
        except Exception as e:
            raise RuntimeError(f"Invoice OCR failed ({type(e).__name__}); fixture data was not substituted") from e

    # Price Hike Detector against SQLite database
    parsed_items: List[InvoiceItemParsed] = []
    price_hikes: List[InvoiceItemParsed] = []

    for item in raw_items:
        sku = item.get("sku", "General Item")
        qty = int(item.get("quantity", 1))
        current_rate = float(item.get("unit_rate", 0.0))

        # Query latest historical price for this SKU
        stmt = (
            select(SkuPriceHistory)
            .where(SkuPriceHistory.sku_name.ilike(f"%{sku.split()[0]}%"))
            .order_by(desc(SkuPriceHistory.created_at))
        )
        result = await db_session.execute(stmt)
        past_record = result.scalars().first()

        prev_rate = past_record.unit_rate if past_record else None
        hike_detected = False
        hike_amount = 0.0
        hike_pct = 0.0
        warning = None

        if prev_rate and current_rate > prev_rate:
            hike_amount = round(current_rate - prev_rate, 2)
            hike_pct = round((hike_amount / prev_rate) * 100, 1)
            # Threshold > 3% or > 5% as per PRD
            if hike_pct >= 5.0:
                hike_detected = True
                warning = f"WARNING: {sku} increased by ₹{hike_amount}/unit (+{hike_pct}%) since {past_record.invoice_date}."

        parsed_obj = InvoiceItemParsed(
            sku=sku,
            quantity=qty,
            unit_rate=current_rate,
            previous_rate=prev_rate,
            price_hike_detected=hike_detected,
            hike_amount=hike_amount,
            hike_percentage=hike_pct,
            warning=warning
        )
        parsed_items.append(parsed_obj)
        if hike_detected:
            price_hikes.append(parsed_obj)

    # Draft quantities and target rates from the actual analyzed lines. This
    # prototype has no stock-count feed, so it avoids inventing low-stock SKUs.
    po_number = f"PO-{uuid.uuid4().hex[:4].upper()}"
    draft_po = DraftPO(
        po_number=po_number,
        supplier_name=vendor_name,
        supplier_phone=supplier_phone,
        items=[
            {
                "sku": item.sku,
                "quantity": item.quantity,
                "expected_rate": item.previous_rate if item.previous_rate is not None else item.unit_rate,
            }
            for item in parsed_items
        ]
    )

    return InvoiceAnalysisResponse(
        success=True,
        vendor_name=vendor_name,
        invoice_no=invoice_no,
        invoice_date=invoice_date,
        items=parsed_items,
        price_hikes=price_hikes,
        draft_po=draft_po,
        analysis_source=analysis_source,
        validation_note=validation_note,
    )
