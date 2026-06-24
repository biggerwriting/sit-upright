import pytest
from unittest.mock import patch, AsyncMock
import uuid


@patch("payment.service.create_qr_code", return_value="mock-qr://abc123")
async def test_create_order_success(mock_qr, client):
    await client.post("/auth/signup", json={"email": "pay@test.com", "password": "password123"})
    r = await client.post("/payment/orders")
    assert r.status_code == 200
    data = r.json()
    assert "orderId" in data
    assert data["qrCode"] == "mock-qr://abc123"


async def test_create_order_unauthenticated(client):
    r = await client.post("/payment/orders")
    assert r.status_code == 401


@patch("payment.service.create_qr_code", return_value="mock-qr://xyz")
async def test_get_order_success(mock_qr, client):
    await client.post("/auth/signup", json={"email": "pay2@test.com", "password": "password123"})
    create_r = await client.post("/payment/orders")
    order_id = create_r.json()["orderId"]

    r = await client.get(f"/payment/orders/{order_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


@patch("payment.service.create_qr_code", return_value="mock-qr://xyz")
async def test_get_order_not_found(mock_qr, client):
    await client.post("/auth/signup", json={"email": "pay3@test.com", "password": "password123"})
    r = await client.get("/payment/orders/nonexistent-id")
    assert r.status_code == 404


@patch("payment.service.verify_notify_signature", return_value=True)
@patch("payment.service.create_qr_code", return_value="mock-qr://notify")
async def test_alipay_notify_success(mock_qr, mock_verify, client, db):
    await client.post("/auth/signup", json={"email": "pay4@test.com", "password": "password123"})
    create_r = await client.post("/payment/orders")
    order_data = create_r.json()

    # 获取 out_trade_no
    from sqlalchemy import select
    from models import Order
    result = await db.execute(select(Order).where(Order.id == order_data["orderId"]))
    order = result.scalar_one()

    r = await client.post(
        "/payment/alipay/notify",
        data={"trade_status": "TRADE_SUCCESS", "out_trade_no": order.out_trade_no, "sign": "mock"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200
    assert r.text == "success"


@patch("payment.service.verify_notify_signature", return_value=False)
async def test_alipay_notify_invalid_signature(mock_verify, client):
    r = await client.post(
        "/payment/alipay/notify",
        data={"trade_status": "TRADE_SUCCESS", "out_trade_no": "fake", "sign": "bad"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 400
