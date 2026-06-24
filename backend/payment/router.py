# backend/payment/router.py
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from auth.dependencies import get_current_user
from models import User
from payment.service import create_order, get_order, handle_alipay_notify
from schemas import CreateOrderResponse, OrderResponse

router = APIRouter(prefix="/payment", tags=["payment"])


@router.post("/orders", response_model=CreateOrderResponse)
async def create_order_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order, qr_code = await create_order(db, current_user.id)
    return CreateOrderResponse(orderId=order.id, qrCode=qr_code)


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order_endpoint(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await get_order(db, order_id, current_user.id)
    return OrderResponse(id=order.id, status=order.status)


@router.post("/alipay/notify")
async def alipay_notify(request: Request, db: AsyncSession = Depends(get_db)):
    form_data = await request.form()
    params = dict(form_data)
    success = await handle_alipay_notify(db, params)
    if not success:
        raise HTTPException(status_code=400, detail="签名验证失败")
    return PlainTextResponse("success")
