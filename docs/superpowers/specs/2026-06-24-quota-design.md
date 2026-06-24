# 坐姿检测 SaaS — 用量统计与配额子系统设计

**日期**：2026-06-24  
**范围**：用量统计与配额子系统（子系统 3/5）  
**状态**：待实现

---

## 背景

在用户认证子系统（子系统 2）的基础上，新增配额管理和检测会话追踪能力。用户注册时自动获得 5 分钟免费试用，购买套餐后配额叠加，按最早到期优先消耗。

---

## 技术选型

| 层 | 选型 |
|---|---|
| 后端 | Python FastAPI（现有） |
| 数据库 | SQLite via SQLAlchemy async（现有） |
| 前端 | Next.js 15 + React（现有） |

---

## 目录结构

```
backend/
  quota/                        ← 新建
    __init__.py
    router.py                   GET /quota, POST /sessions, PATCH /sessions/{id}, PATCH /sessions/{id}/end
    service.py                  get_quota, create_session, update_session, end_session
  models.py                     新增 QuotaPackage、Session 模型
  schemas.py                    新增 NearExpiry, QuotaResponse, CreateSessionResponse, SessionStatsResponse

frontend/src/
  types/index.ts                更新 QuotaInfo（新增 nearExpiry 字段）
  components/detection/
    QuotaBanner.tsx             更新：支持 nearExpiry 预警显示
    types.ts                    更新 QuotaBannerProps
  __tests__/components/
    QuotaBanner.test.tsx        更新：补充 nearExpiry 相关测试用例
```

---

## 数据模型

### quota_packages（套餐配额明细）

| 字段 | 类型 | 约束 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | FK → users.id, NOT NULL |
| remaining_seconds | INTEGER | NOT NULL, DEFAULT 0, ≥ 0 |
| expires_at | DATETIME | NULL = 永不过期 |
| created_at | DATETIME | DEFAULT now() |

### sessions（检测会话）

| 字段 | 类型 | 约束 |
|---|---|---|
| id | TEXT | PRIMARY KEY（UUID） |
| user_id | INTEGER | FK → users.id, NOT NULL |
| good_seconds | INTEGER | NOT NULL, DEFAULT 0 |
| bad_seconds | INTEGER | NOT NULL, DEFAULT 0 |
| started_at | DATETIME | NOT NULL |
| ended_at | DATETIME | NULL = 进行中 |

---

## 注册时配额发放

`auth/service.py` 的 `create_user` 函数在创建用户后，同一事务内插入免费试用配额：

```python
free_trial = QuotaPackage(
    user_id=user.id,
    remaining_seconds=300,  # 5 分钟
    expires_at=None,        # 永不过期，不触发预警
)
db.add(free_trial)
await db.commit()
```

---

## API 端点

### GET /quota

返回当前用户的配额概览。

**响应：**
```json
{
  "remainingSeconds": 3000,
  "nearExpiry": {
    "seconds": 1800,
    "expiresAt": "2026-06-27T10:00:00Z"
  }
}
```

- `remainingSeconds`：所有未过期套餐的 `remaining_seconds` 总和
- `nearExpiry`：若有任意套餐将在 **3 天内**到期（`expires_at > now AND expires_at < now + 3d`），填充最早到期包的信息；否则为 `null`
- 免费试用（`expires_at = NULL`）永不触发 nearExpiry 预警

### POST /sessions

创建新检测会话。

- 若配额总和 = 0 → 返回 402
- 插入 sessions 记录（good=0, bad=0, started_at=now）
- 返回 `{ "sessionId": "<uuid>" }`

### PATCH /sessions/{id}

上报坐姿数据，扣减配额。

**请求体：**
```json
{ "goodSeconds": 45, "badSeconds": 15 }
```

**扣减逻辑：**
```
delta = (新 good + 新 bad) - (session.good + session.bad)
按 expires_at ASC NULLS LAST 顺序遍历该用户未过期的 quota_packages：
  每个包扣减 min(delta, package.remaining_seconds)
  delta -= 已扣量
  若 delta == 0：停止
若遍历结束 delta 仍 > 0（配额不足）：返回 402，前端停止检测
更新 session.good_seconds = 新 good，session.bad_seconds = 新 bad
```

**正常响应：** `{ "ok": true }`  
**配额耗尽：** HTTP 402

### PATCH /sessions/{id}/end

结束会话。

- 设置 `session.ended_at = now()`
- 返回 `SessionStatsResponse`

**响应：**
```json
{
  "totalSeconds": 60,
  "goodSeconds": 45,
  "badSeconds": 15,
  "segments": [
    { "type": "good", "durationSeconds": 45 },
    { "type": "bad", "durationSeconds": 15 }
  ]
}
```

> `segments` 由后端根据最终 good/bad 总量拼成两段（简化实现）。精细的时间轴分段数据由前端 `useSessionTracker` 在本地维护，用于实时显示，后端不存储逐帧数据。

---

## 错误码规范

| 场景 | HTTP 状态 |
|---|---|
| 配额为 0，无法开始会话 | 402 |
| 配额耗尽（上报时不足以扣减） | 402 |
| sessionId 不存在或不属于当前用户 | 404 |
| PATCH /sessions/{id} 调用已结束的会话 | 400 |
| 会话已结束（重复调用 end） | 400 |

---

## 前端改动

### types/index.ts

```typescript
export type NearExpiry = {
  seconds: number
  expiresAt: string  // ISO 8601
}

export type QuotaInfo = {
  remainingSeconds: number
  nearExpiry: NearExpiry | null
}
```

### QuotaBannerProps（components/detection/types.ts）

```typescript
export type QuotaBannerProps = {
  remainingSeconds: number
  nearExpiry: { seconds: number; expiresAt: string } | null
}
```

### QuotaBanner 显示逻辑

| 状态 | 显示 |
|---|---|
| `remainingSeconds > 0`，`nearExpiry = null` | 「剩余用量：N 分钟」（绿色） |
| `remainingSeconds > 0`，`nearExpiry != null` | 「⚠ 剩余用量：N 分钟（其中 M 分钟将于 X 到期）」（橙色） |
| `remainingSeconds === 0` | 「用量已耗尽」+ 「购买套餐」链接（红色） |

### DetectionPage 改动（app/app/page.tsx）

- `quota` 状态从 `number | null` 改为 `QuotaInfo | null`，存储完整响应对象
- 传给 `QuotaBanner`：`remainingSeconds={quota.remainingSeconds} nearExpiry={quota.nearExpiry}`
- 配额检查：`quota.remainingSeconds === 0` 时跳转 `/pricing`
- 当 `PATCH /sessions/{id}` 返回 402 时，前端调用 `stopSession()`，弹出提示「配额已耗尽，请购买套餐」

---

## 未覆盖范围（后续子系统）

- 历史会话列表与详情页（子系统 4）
- 套餐购买与支付流程，真实配额充值（子系统 5）
