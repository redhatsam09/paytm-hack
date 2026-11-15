import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import declarative_base

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_name = Column(String(120), nullable=False, default="Sri Lakshmi Stores")
    vpa = Column(String(100), nullable=False, default="srilakshmi@paytm")
    phone = Column(String(20), nullable=False, default="+919876543210")
    default_language = Column(String(10), nullable=False, default="hi")
    created_at = Column(DateTime, default=get_utc_now)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(String(50), unique=True, index=True, nullable=False)
    total_bill = Column(Float, nullable=False)
    upi_due = Column(Float, nullable=False)
    upi_received = Column(Float, default=0.0)
    cash_received = Column(Float, default=0.0)
    udhari_amount = Column(Float, default=0.0)
    customer_name = Column(String(100), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    due_date = Column(String(30), nullable=True)
    items_summary = Column(Text, nullable=True)
    status = Column(String(30), default="PENDING_PAYMENT")  # PENDING_PAYMENT, COMPLETED, SHORT_PAYMENT, EXPIRED
    utr = Column(String(100), nullable=True)
    qr_data = Column(Text, nullable=False)
    qr_code_url = Column(Text, nullable=False)
    payment_mode = Column(String(30), nullable=False, default="DEMO")
    created_at = Column(DateTime, default=get_utc_now)
    completed_at = Column(DateTime, nullable=True)

class UdhariLedger(Base):
    __tablename__ = "udhari_ledger"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(36), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    amount_due = Column(Float, nullable=False)
    due_date = Column(String(30), nullable=False)
    status = Column(String(30), default="UNPAID")  # UNPAID, SETTLED; reminder preparation does not change settlement state
    paytm_payment_link = Column(Text, nullable=False)
    payment_link_id = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=get_utc_now)
    settled_at = Column(DateTime, nullable=True)

class SkuPriceHistory(Base):
    __tablename__ = "sku_price_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sku_name = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)
    supplier_name = Column(String(120), nullable=False)
    unit_rate = Column(Float, nullable=False)
    invoice_date = Column(String(30), nullable=False)
    invoice_image_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

class RestockOrder(Base):
    __tablename__ = "restock_orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    po_number = Column(String(50), unique=True, nullable=False)
    supplier_name = Column(String(120), nullable=False)
    supplier_phone = Column(String(20), nullable=False)
    items = Column(JSON, nullable=False)  # list of {"sku": str, "quantity": int, "expected_rate": float}
    status = Column(String(30), default="DRAFT_READY")  # Draft saved locally; WhatsApp dispatch is a separate merchant action
    created_at = Column(DateTime, default=get_utc_now)
