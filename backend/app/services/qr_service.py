import io
import base64
import urllib.parse
import qrcode
from app.config import settings

def generate_paytm_upi_string(
    amount: float,
    invoice_id: str,
    merchant_vpa: str = None,
    merchant_name: str = None,
    note: str = None
) -> str:
    """
    Generate an explicitly non-payable local demo QR payload.
    Real amount-locked payment QRs must come from Paytm's authenticated API.
    """
    vpa = merchant_vpa or settings.DEFAULT_MERCHANT_VPA
    pn = merchant_name or settings.DEFAULT_MERCHANT_NAME
    formatted_amount = f"{amount:.2f}"
    tn = note or f"Invoice {invoice_id}"

    params = {
        "pa": vpa,
        "pn": pn,
        "am": formatted_amount,
        "tr": invoice_id,
        "cu": "INR",
        "tn": tn,
        "mc": "5411",  # Grocery Stores / Supermarkets merchant category code
        "mode": "02"   # Dynamic QR mode
    }

    query_string = urllib.parse.urlencode(params)
    return f"upi://pay?{query_string}"

def generate_qr_base64(payload_text: str) -> str:
    """
    Generate a high-contrast QR code PNG image encoded as a base64 Data URL.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(payload_text)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#002970", back_color="#FFFFFF")  # Paytm Deep Blue
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_bytes = buffered.getvalue()
    b64 = base64.b64encode(img_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"
