# backend/payment/service.py
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Order, QuotaPackage
from payment.alipay import create_qr_code, verify_notify_signature

PRODUCT_PRICE_CENTS = int(os.getenv("PRODUCT_PRICE_CENTS", "990"))
PRODUCT_QUOTA_SECONDS = int(os.getenv("PRODUCT_QUOTA_SECONDS", "3600"))
PRODUCT_QUOTA_EXPIRE_DAYS = int(os.getenv("PRODUCT_QUOTA_EXPIRE_DAYS", "7"))
PRODUCT_SUBJECT = "坐姿检测 标准套餐"


async def create_order(db: AsyncSession, user_id: int) -> tuple[Order, str]:
    out_trade_no = f"{user_id}_{int(time.time() * 1000)}"
    amount_yuan = f"{PRODUCT_PRICE_CENTS / 100:.2f}"

    try:
        qr_code = create_qr_code(out_trade_no, amount_yuan, PRODUCT_SUBJECT)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建支付订单失败: {e}")

    order = Order(
        id=str(uuid.uuid4()),
        user_id=user_id,
        out_trade_no=out_trade_no,
        amount_cents=PRODUCT_PRICE_CENTS,
        status="pending",
        quota_granted=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order, qr_code


async def get_order(db: AsyncSession, order_id: str, user_id: int) -> Order:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


async def handle_alipay_notify(db: AsyncSession, params: dict) -> bool:
    """处理支付宝回调，返回 True 表示处理成功（无论是否充值）。"""
    params_copy = dict(params)

    if not verify_notify_signature(params_copy):
        return False

    trade_status = params_copy.get("trade_status", "")
    out_trade_no = params_copy.get("out_trade_no", "")

    if trade_status != "TRADE_SUCCESS":
        return True  # 告知支付宝不再重试

    result = await db.execute(
        select(Order).where(Order.out_trade_no == out_trade_no)
    )
    order = result.scalar_one_or_none()
    if not order:
        return True

    if order.quota_granted:
        return True  # 幂等：已充值，直接成功

    # 充值
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=PRODUCT_QUOTA_EXPIRE_DAYS)
    pkg = QuotaPackage(
        user_id=order.user_id,
        remaining_seconds=PRODUCT_QUOTA_SECONDS,
        expires_at=expires,
    )
    db.add(pkg)

    order.status = "paid"
    order.quota_granted = True
    order.paid_at = now
    await db.commit()
    return True
