import pytest
import uuid
from datetime import datetime, timezone
from models import Order


async def test_create_order(db):
    order = Order(
        id=str(uuid.uuid4()),
        user_id=1,
        out_trade_no="1_1719000000000",
        amount_cents=990,
        status="pending",
        quota_granted=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    assert order.id is not None
    assert order.status == "pending"
    assert order.quota_granted is False
    assert order.paid_at is None
