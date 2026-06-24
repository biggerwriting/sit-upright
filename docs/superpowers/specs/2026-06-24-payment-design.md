# 坐姿检测 SaaS — 支付与套餐子系统设计

**日期**：2026-06-24  
**范围**：支付与套餐子系统（子系统 5/5）  
**状态**：待实现

---

## 背景

通过支付宝当面付（扫码支付）实现套餐充值，支付成功后自动为用户增加 1 小时（3600 秒）检测配额，有效期 7 天。

---

## 唯一套餐

| 字段 | 值 |
|---|---|
| 名称 | 标准套餐 |
| 金额 | ¥9.9（990 分） |
| 配额 | 3600 秒（1 小时） |
| 有效期 | 7 天（expires_at = 购买时 + 7 days） |

---

## 数据模型

### orders 表

| 字段 | 类型 | 约束 |
|---|---|---|
| id | TEXT | PRIMARY KEY（UUID） |
| user_id | INTEGER | FK → users.id, NOT NULL |
| out_trade_no | TEXT | UNIQUE, NOT NULL（格式：`{user_id}_{timestamp_ms}`） |
| amount_cents | INTEGER | NOT NULL（990） |
| status | TEXT | NOT NULL, DEFAULT 'pending'（pending/paid/failed） |
| quota_granted | BOOLEAN | NOT NULL, DEFAULT false（防重复充值）|
| created_at | DATETIME | NOT NULL |
| paid_at | DATETIME | NULL |

---

## 目录结构

```
backend/
  payment/
    __init__.py
    router.py      POST /payment/orders, GET /payment/orders/{id}, POST /payment/alipay/notify
    service.py     create_order, get_order, handle_alipay_notify
    alipay.py      支付宝 SDK 封装（create_qr_code, verify_notify_signature）
  models.py        新增 Order 模型
  schemas.py       新增 OrderResponse, CreateOrderResponse
  main.py          注册 payment router

frontend/src/
  types/index.ts                新增 Order 类型
  lib/api.ts                    新增 api.payment.*
  components/payment/
    PaymentModal.tsx             二维码弹窗 + 轮询逻辑
  app/pricing/page.tsx          更新（登录检查 + 调 API）
```

---

## 环境变量（.env）

```
# 支付宝（沙箱/生产切换只改这几行）
ALIPAY_APP_ID=your_app_id
ALIPAY_PRIVATE_KEY=your_rsa2_private_key_base64
ALIPAY_PUBLIC_KEY=alipay_rsa2_public_key_base64
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://your-domain.com/payment/alipay/notify

# 套餐配置
PRODUCT_PRICE_CENTS=990
PRODUCT_QUOTA_SECONDS=3600
PRODUCT_QUOTA_EXPIRE_DAYS=7
```

---

## API 端点

### POST /payment/orders（需认证）

创建订单并调用支付宝获取二维码。

**响应：**
```json
{
  "orderId": "uuid",
  "qrCode": "https://qr.alipay.com/xxx"
}
```

**流程：**
1. 生成 `out_trade_no = f"{user_id}_{int(time.time() * 1000)}"`
2. 插入 orders 表（status=pending）
3. 调用支付宝 `alipay.trade.precreate`，传入 subject/out_trade_no/total_amount
4. 返回 `{ orderId, qrCode }`

**错误：** 支付宝调用失败 → 500

---

### GET /payment/orders/{order_id}（需认证）

前端轮询订单状态。

**响应：**
```json
{ "id": "uuid", "status": "pending" }
```

- `status` 为 `pending`/`paid`/`failed`
- 订单不属于当前用户 → 404

---

### POST /payment/alipay/notify（无需认证，支付宝回调）

**处理流程（幂等）：**
```
1. 用支付宝公钥验证签名（verify_notify_signature）
   → 签名不合法 → 返回 HTTP 400
2. 检查 trade_status == "TRADE_SUCCESS"
   → 不是成功状态 → 返回纯文本 "success"（告知支付宝不再重试）
3. 查询 orders WHERE out_trade_no = ?
   → 找不到 → 返回 "success"
4. 若 order.quota_granted == True → 返回 "success"（已处理，幂等）
5. 插入 QuotaPackage（
       user_id = order.user_id,
       remaining_seconds = PRODUCT_QUOTA_SECONDS,
       expires_at = now + PRODUCT_QUOTA_EXPIRE_DAYS days
   ）
6. 更新 order：status=paid, quota_granted=True, paid_at=now
7. 返回纯文本 "success"
```

> 支付宝要求回调必须返回纯文本 `"success"`，否则会重试。
> `quota_granted` 字段确保即使回调重复到达也只充值一次。

---

## 前端交互

### 定价页（/pricing）更新

- 「立即购买」按钮逻辑：
  - 未登录 → 跳转 `/login?redirect=/pricing`
  - 已登录 → 调 `POST /payment/orders` → 弹出 PaymentModal

### PaymentModal

```
┌────────────────────────────┐
│  扫码支付 ¥9.9              │
│                            │
│  ┌──────────────────────┐  │
│  │    [QR Code 图片]    │  │
│  └──────────────────────┘  │
│                            │
│  7天内1小时坐姿检测服务     │
│  请用支付宝扫码             │
│                            │
│  ○ 等待支付…               │
└────────────────────────────┘
```

- 用 `qrcode.react` 将 qrCode 字符串渲染成二维码图片
- 弹窗打开后每 3 秒轮询 `GET /payment/orders/{orderId}`
- `status === 'paid'` → 关弹窗 → 更新配额显示 → 跳转 `/app`
- 关闭弹窗 → 停止轮询

### 前端类型（types/index.ts）

```typescript
export type Order = {
  id: string
  status: 'pending' | 'paid' | 'failed'
}

export type CreateOrderResponse = {
  orderId: string
  qrCode: string
}
```

### api.ts 新增

```typescript
payment: {
  createOrder(): Promise<CreateOrderResponse>
  getOrder(orderId: string): Promise<Order>
}
```

---

## 依赖库

```
# backend/requirements.txt 新增
alipay-sdk-python-all>=3.0.0

# frontend 新增
qrcode.react
```

---

## 测试策略

- **支付宝 alipay.py**：mock SDK，测试 `create_qr_code` 调用参数格式
- **service.py**：mock alipay.py，测试订单创建、幂等回调处理
- **router.py**：集成测试，mock alipay.py，测试 3 个端点
- **PaymentModal**：mock api，测试轮询逻辑（pending→paid）、关闭停止轮询
- **notify 回调**：由于需要真实支付宝签名，单元测试中 mock `verify_notify_signature`
