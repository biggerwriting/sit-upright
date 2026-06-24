# backend/tests/test_payment_service.py
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from payment.service import create_order, get_order, handle_alipay_notify
from models import Order, QuotaPackage


# ── create_order ─────────────────────────────────────────────

@patch("payment.service.create_qr_code", return_value="mock-qr://test123")
async def test_create_order_success(mock_qr, db):
    order, qr = await create_order(db, user_id=1)
    assert order.id is not None
    assert order.status == "pending"
    assert order.quota_granted is False
    assert order.amount_cents == 990
    assert qr == "mock-qr://test123"
    mock_qr.assert_called_once()


@patch("payment.service.create_qr_code", side_effect=RuntimeError("alipay error"))
async def test_create_order_alipay_failure(mock_qr, db):
    with pytest.raises(HTTPException) as exc:
        await create_order(db, user_id=1)
    assert exc.value.status_code == 500


# ── get_order ────────────────────────────────────────────────

async def test_get_order_success(db):
    order = Order(
        id=str(uuid.uuid4()),
        user_id=1,
        out_trade_no="1_100",
        amount_cents=990,
        status="pending",
        quota_granted=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()

    found = await get_order(db, order.id, user_id=1)
    assert found.id == order.id


async def test_get_order_wrong_user(db):
    order = Order(
        id=str(uuid.uuid4()),
        user_id=1,
        out_trade_no="1_101",
        amount_cents=990,
        status="pending",
        quota_granted=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await get_order(db, order.id, user_id=2)
    assert exc.value.status_code == 404


async def test_get_order_not_found(db):
    with pytest.raises(HTTPException) as exc:
        await get_order(db, "nonexistent-id", user_id=1)
    assert exc.value.status_code == 404


# ── handle_alipay_notify ─────────────────────────────────────

@patch("payment.service.verify_notify_signature", return_value=True)
async def test_notify_grants_quota(mock_verify, db):
    order = Order(
        id=str(uuid.uuid4()),
        user_id=1,
        out_trade_no="1_200",
        amount_cents=990,
        status="pending",
        quota_granted=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()

    params = {
        "trade_status": "TRADE_SUCCESS",
        "out_trade_no": "1_200",
        "sign": "mocked",
    }
    result = await handle_alipay_notify(db, params)
    assert result is True

    await db.refresh(order)
    assert order.status == "paid"
    assert order.quota_granted is True
    assert order.paid_at is not None

    from sqlalchemy import select
    pkg_result = await db.execute(
        select(QuotaPackage).where(QuotaPackage.user_id == 1)
    )
    pkg = pkg_result.scalar_one_or_none()
    assert pkg is not None
    assert pkg.remaining_seconds == 3600
    assert pkg.expires_at is not None


@patch("payment.service.verify_notify_signature", return_value=True)
async def test_notify_idempotent(mock_verify, db):
    """回调重复到达时不重复充值。"""
    order = Order(
        id=str(uuid.uuid4()),
        user_id=1,
        out_trade_no="1_201",
        amount_cents=990,
        status="paid",
        quota_granted=True,
        created_at=datetime.now(timezone.utc),
        paid_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()

    params = {
        "trade_status": "TRADE_SUCCESS",
        "out_trade_no": "1_201",
        "sign": "mocked",
    }
    result = await handle_alipay_notify(db, params)
    assert result is True

    from sqlalchemy import select, func
    count_result = await db.execute(
        select(func.count()).where(QuotaPackage.user_id == 1)
    )
    assert count_result.scalar() == 0  # 没有新增 QuotaPackage


@patch("payment.service.verify_notify_signature", return_value=False)
async def test_notify_invalid_signature(mock_verify, db):
    params = {"trade_status": "TRADE_SUCCESS", "out_trade_no": "1_999", "sign": "bad"}
    result = await handle_alipay_notify(db, params)
    assert result is False
