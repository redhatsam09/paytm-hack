"""Paytm Dynamic QR and server-to-server transaction verification."""
import json
from datetime import datetime, timedelta
from typing import Any

import httpx
from paytmchecksum import PaytmChecksum

from app.config import paytm_host, settings


def _signed_body(body: dict[str, Any]) -> tuple[str, str]:
    # Sign and send the same compact JSON representation.
    body_json = json.dumps(body, separators=(",", ":"), ensure_ascii=False)
    signature = PaytmChecksum.generateSignature(body_json, settings.PAYTM_MERCHANT_KEY)
    return body_json, signature


def verify_callback_signature(fields: dict[str, str]) -> bool:
    checksum = fields.get("CHECKSUMHASH") or fields.get("checksumHash")
    if not checksum:
        return False
    clean_fields = {k: v for k, v in fields.items() if k not in {"CHECKSUMHASH", "checksumHash"}}
    return bool(PaytmChecksum.verifySignature(clean_fields, settings.PAYTM_MERCHANT_KEY, checksum))


async def create_dynamic_qr(*, order_id: str, amount: float, phone: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "mid": settings.PAYTM_MID,
        "orderId": order_id,
        "amount": f"{amount:.2f}",
        "businessType": "UPI_QR_CODE",
        "posId": settings.PAYTM_POS_ID,
        "orderDetails": "Kirana counter payment",
        "invoiceDetails": order_id,
        "expiryDate": (datetime.now() + timedelta(seconds=settings.QR_EXPIRY_SECONDS)).strftime("%Y-%m-%d %H:%M:%S"),
        "imageRequired": True,
        "displayName": settings.DEFAULT_MERCHANT_NAME[:50],
    }
    if phone:
        body["contactPhoneNo"] = phone
    body_json, signature = _signed_body(body)
    head = {"version": "v1", "channelId": "WEB", "signature": signature}
    if settings.PAYTM_CLIENT_ID:
        head["clientId"] = settings.PAYTM_CLIENT_ID
    request_json = f'{{"body":{body_json},"head":{json.dumps(head, separators=(",", ":"))}}}'

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{paytm_host()}/paymentservices/qr/create",
            content=request_json,
            headers={"Content-Type": "application/json"},
        )
    response.raise_for_status()
    payload = response.json()
    response_body = payload.get("body", {})
    response_signature = payload.get("head", {}).get("signature")
    if not response_signature or not PaytmChecksum.verifySignature(
        json.dumps(response_body, separators=(",", ":"), ensure_ascii=False),
        settings.PAYTM_MERCHANT_KEY,
        response_signature,
    ):
        raise ValueError("Paytm QR response signature is invalid")
    result = response_body.get("resultInfo", {})
    qr_data = response_body.get("qrData")
    if result.get("resultStatus") != "SUCCESS" or not qr_data:
        raise ValueError(result.get("resultMsg") or "Paytm did not create a QR code")
    return {"qr_data": qr_data, "qr_code_id": response_body.get("qrCodeId")}


async def fetch_transaction_status(order_id: str) -> dict[str, Any]:
    body = {"mid": settings.PAYTM_MID, "orderId": order_id}
    body_json, signature = _signed_body(body)
    head = {"signature": signature}
    if settings.PAYTM_CLIENT_ID:
        head["clientId"] = settings.PAYTM_CLIENT_ID
    request_json = f'{{"body":{body_json},"head":{json.dumps(head, separators=(",", ":"))}}}'
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.post(
            f"{paytm_host()}/v3/order/status",
            content=request_json,
            headers={"Content-Type": "application/json"},
        )
    response.raise_for_status()
    payload = response.json()
    result_body = payload.get("body", {})
    response_signature = payload.get("head", {}).get("signature")
    if not response_signature or not PaytmChecksum.verifySignature(
        json.dumps(result_body, separators=(",", ":"), ensure_ascii=False),
        settings.PAYTM_MERCHANT_KEY,
        response_signature,
    ):
        raise ValueError("Paytm status response signature is invalid")
    return result_body
