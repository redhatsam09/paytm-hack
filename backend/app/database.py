import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text, inspect
from app.config import settings
from app.models import Base, Merchant, SkuPriceHistory, UdhariLedger

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Upgrade existing local SQLite databases without requiring a reset.
        columns = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_columns("transactions"))
        if not any(column["name"] == "payment_mode" for column in columns):
            await conn.execute(text("ALTER TABLE transactions ADD COLUMN payment_mode VARCHAR(30) NOT NULL DEFAULT 'DEMO'"))

    # Seed initial data if merchants table is empty
    async with async_session() as session:
        merchant_check = await session.execute(select(Merchant))
        if not merchant_check.scalars().first():
            # Seed default merchant
            merchant = Merchant(
                id=str(uuid.uuid4()),
                store_name=settings.DEFAULT_MERCHANT_NAME,
                vpa=settings.DEFAULT_MERCHANT_VPA,
                phone=settings.DEFAULT_MERCHANT_PHONE,
                default_language=settings.DEFAULT_LANGUAGE
            )
            session.add(merchant)

            # Seed SKU price history
            skus = [
                SkuPriceHistory(
                    id=str(uuid.uuid4()),
                    sku_name="Fortune Sunflower Oil 1L",
                    category="Edible Oils",
                    supplier_name="Adani Wilmar Dist.",
                    unit_rate=140.0,
                    invoice_date="2026-10-12",
                    invoice_image_url="/static/sample_invoices/adani_oct.jpg"
                ),
                SkuPriceHistory(
                    id=str(uuid.uuid4()),
                    sku_name="Tata Salt 1kg",
                    category="Groceries",
                    supplier_name="Tata Consumer Dist.",
                    unit_rate=28.0,
                    invoice_date="2026-10-15",
                    invoice_image_url="/static/sample_invoices/tata_oct.jpg"
                ),
                SkuPriceHistory(
                    id=str(uuid.uuid4()),
                    sku_name="India Gate Basmati Rice 5kg",
                    category="Grains",
                    supplier_name="KRBL Foods Dist.",
                    unit_rate=420.0,
                    invoice_date="2026-10-20",
                    invoice_image_url="/static/sample_invoices/krbl_oct.jpg"
                ),
                SkuPriceHistory(
                    id=str(uuid.uuid4()),
                    sku_name="Aashirvaad Atta 10kg",
                    category="Flour",
                    supplier_name="ITC Wholesale",
                    unit_rate=410.0,
                    invoice_date="2026-10-22",
                    invoice_image_url="/static/sample_invoices/itc_oct.jpg"
                ),
                SkuPriceHistory(
                    id=str(uuid.uuid4()),
                    sku_name="Toor Dal 1kg",
                    category="Pulses",
                    supplier_name="Shri Balaji Traders",
                    unit_rate=160.0,
                    invoice_date="2026-10-25",
                    invoice_image_url="/static/sample_invoices/balaji_oct.jpg"
                ),
            ]
            session.add_all(skus)

            # Seed initial Udhari entries
            udhari_entries = [
                UdhariLedger(
                    id=str(uuid.uuid4()),
                    transaction_id=None,
                    customer_name="Ramesh",
                    customer_phone="9876543210",
                    amount_due=250.0,
                    due_date="2026-11-17",
                    status="UNPAID",
                    paytm_payment_link="https://p.paytm.me/pay?id=udh-101&am=250.00",
                    payment_link_id="udh-101"
                ),
                UdhariLedger(
                    id=str(uuid.uuid4()),
                    transaction_id=None,
                    customer_name="Suresh Verma",
                    customer_phone="9811223344",
                    amount_due=450.0,
                    due_date="2026-11-12",
                    status="REMINDER_SENT",
                    paytm_payment_link="https://p.paytm.me/pay?id=udh-102&am=450.00",
                    payment_link_id="udh-102"
                ),
                UdhariLedger(
                    id=str(uuid.uuid4()),
                    transaction_id=None,
                    customer_name="Anita Sharma",
                    customer_phone="9988776655",
                    amount_due=180.0,
                    due_date="2026-11-05",
                    status="SETTLED",
                    paytm_payment_link="https://p.paytm.me/pay?id=udh-103&am=180.00",
                    payment_link_id="udh-103"
                ),
            ]
            session.add_all(udhari_entries)

            await session.commit()
