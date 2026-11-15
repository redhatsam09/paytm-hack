import uuid
from typing import Dict, Any, List, Tuple

def create_paytm_payment_link(amount: float, link_id: str = None) -> Tuple[str, str]:
    """Generate a shareable Paytm Payment link for off-counter WhatsApp collection."""
    lid = link_id or f"udh-{uuid.uuid4().hex[:8]}"
    url = f"https://p.paytm.me/pay?id={lid}&am={amount:.2f}"
    return url, lid

def format_udhari_whatsapp_message(
    customer_name: str,
    amount: float,
    due_date: str,
    payment_link: str,
    store_name: str = "Sri Lakshmi Stores"
) -> Dict[str, Any]:
    """Format professional WhatsApp message for credit balance collection."""
    text = (
        f"Dear {customer_name},\n\n"
        f"Your store credit balance of ₹{int(amount) if amount.is_integer() else amount:.2f} at {store_name} is scheduled for payment on {due_date}.\n\n"
        f"Please complete your payment using this secure direct link:\n"
        f"{payment_link}\n\n"
        f"Your account balance will be settled immediately upon payment completion. Thank you."
    )

    return {
        "channel": "whatsapp",
        "type": "payment_reminder",
        "recipient": customer_name,
        "customer_name": customer_name,
        "amount": amount,
        "payment_link": payment_link,
        "due_date": due_date,
        "message": text,
        "actions": [
            {
                "type": "PAYTM_UPI_LINK",
                "label": f"Pay ₹{amount:.2f} via Paytm",
                "url": payment_link
            }
        ]
    }

def format_po_whatsapp_message(
    po_number: str,
    supplier_name: str,
    items: List[Dict[str, Any]],
    store_name: str = "Sri Lakshmi Stores"
) -> Dict[str, Any]:
    """Format Purchase Order dispatch message for Wholesaler WhatsApp."""
    items_lines = []
    total_est = 0.0
    for idx, itm in enumerate(items, 1):
        sku = itm.get("sku", "Item")
        qty = itm.get("quantity", 1)
        rate = itm.get("expected_rate", 0.0)
        line_tot = qty * rate
        total_est += line_tot
        items_lines.append(f"  {idx}. {sku} - {qty} units @ ₹{rate:.2f} (₹{line_tot:.2f})")

    items_text = "\n".join(items_lines)
    message = (
        f"PURCHASE ORDER: #{po_number}\n"
        f"To: {supplier_name}\n"
        f"From: {store_name} (+919876543210)\n\n"
        f"Required Stock Items:\n{items_text}\n\n"
        f"Estimated Total: ₹{total_est:.2f}\n"
        f"Please confirm delivery schedule and dispatch invoice.\n"
        f"Thank you."
    )

    return {
        "channel": "whatsapp",
        "type": "purchase_order",
        "recipient": supplier_name,
        "po_number": po_number,
        "message": message,
        "estimated_total": total_est
    }
