# 坐姿检测 SaaS — 历史记录子系统设计

**日期**：2026-06-24  
**范围**：历史记录子系统（子系统 4/5）  
**状态**：待实现

---

## 背景

在配额子系统（子系统 3）的基础上，新增历史会话查看能力。用户可以在配额耗尽后仍然查看过去的检测记录。

---

## 数据来源

复用已有的 `sessions` 表（子系统 3 创建）：

| 字段 | 说明 |
|---|---|
| id | UUID 字符串 |
| user_id | 关联用户 |
| good_seconds | 优秀坐姿累计秒数 |
| bad_seconds | 不良坐姿累计秒数 |
| started_at | 会话开始时间 |
| ended_at | 会话结束时间（NULL = 进行中，不展示） |

历史页面**只展示 `ended_at IS NOT NULL` 的已结束会话**，按 `started_at DESC` 排序。

---

## API 端点

### GET /sessions

返回当前登录用户的已结束会话列表，游标分页。

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `limit` | int | 10 | 每批返回数量 |
| `before` | string (ISO 8601) | 无 | 游标：返回 started_at 早于此时间的记录 |

**响应：**
```json
{
  "sessions": [
    {
      "id": "uuid-string",
      "startedAt": "2026-06-24T14:32:00Z",
      "endedAt":   "2026-06-24T14:57:00Z",
      "totalSeconds": 1500,
      "goodSeconds":  1200,
      "badSeconds":   300
    }
  ],
  "hasMore": true
}
```

- `sessions` 按 `started_at DESC` 排序
- `hasMore`：若还有更早的记录则为 `true`，否则 `false`
- 首次请求不传 `before`；后续请求传上批最后一条的 `startedAt`

---

## 后端实现

在 `backend/quota/` 模块扩展：

**新增 schema（schemas.py）：**
```python
class SessionListItem(BaseModel):
    id: str
    startedAt: datetime
    endedAt: datetime
    totalSeconds: int
    goodSeconds: int
    badSeconds: int

class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    hasMore: bool
```

**新增 service 函数（quota/service.py）：**
```python
async def list_sessions(
    db: AsyncSession,
    user_id: int,
    limit: int = 10,
    before: datetime | None = None,
) -> SessionListResponse
```

查询逻辑：
```sql
SELECT * FROM sessions
WHERE user_id = :user_id
  AND ended_at IS NOT NULL
  AND (before IS NULL OR started_at < :before)
ORDER BY started_at DESC
LIMIT :limit + 1  -- 多取 1 条判断 hasMore
```

**新增 router 端点（quota/router.py）：**
```
GET /sessions?limit=10&before=<ISO8601>
```

需认证（`get_current_user`）。

---

## 前端实现

### 新增/修改文件

```
frontend/src/
  lib/api.ts                         新增 api.sessions.list()
  types/index.ts                     新增 SessionListItem, SessionListResponse
  hooks/useSessionHistory.ts         新增：列表状态 + loadMore
  components/history/
    SessionCard.tsx                  新增：单张卡片（复用 PostureTimeline）
  app/history/page.tsx               替换 stub
```

### api.ts 新增方法

```typescript
sessions: {
  list(params?: { before?: string; limit?: number }): Promise<SessionListResponse>
}
```

### useSessionHistory hook

```typescript
type UseSessionHistoryReturn = {
  sessions: SessionListItem[]
  loading: boolean
  hasMore: boolean
  loadMore(): void
}
```

- 挂载时自动加载第一批
- `loadMore()` 追加到列表末尾，用最后一条的 `startedAt` 作为 `before` 游标
- 正在加载时忽略重复调用

### SessionCard 会话卡片

```
┌─────────────────────────────────────────────────────┐
│  2026年6月24日 14:32            总时长：25 分钟       │
│                                                     │
│  优秀坐姿：20 分钟 (80%)   不良坐姿：5 分钟 (20%)    │
│                                                     │
│  [绿──────────────────────][橙───]                  │
└─────────────────────────────────────────────────────┘
```

时间轴复用 `<PostureTimeline>`，传入两段 segments（good + bad）。

### HistoryPage 页面结构

```tsx
<main>
  <h1>历史记录</h1>

  {sessions.map(s => <SessionCard key={s.id} session={s} />)}

  {/* 哨兵元素：进入视口时触发 loadMore */}
  <div ref={sentinelRef} />

  {loading && <p>加载中…</p>}
  {!hasMore && sessions.length > 0 && <p>已加载全部记录</p>}
  {!loading && sessions.length === 0 && <p>暂无检测记录</p>}
</main>
```

`IntersectionObserver` 监听 `sentinelRef`，进入视口且 `hasMore && !loading` 时调用 `loadMore()`。

---

## 错误码

| 场景 | HTTP 状态 |
|---|---|
| 未登录 | 401 |
| limit 超出范围（> 50）| 422 |
| before 格式非法 | 422 |

---

## 未覆盖范围（后续子系统）

- 套餐购买与支付流程（子系统 5）
