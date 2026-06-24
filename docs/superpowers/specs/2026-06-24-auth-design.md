# 坐姿检测 SaaS — 用户认证子系统设计

**日期**：2026-06-24  
**范围**：用户认证子系统（子系统 2/5）  
**状态**：待实现

---

## 背景

在前端子系统（子系统 1）的基础上，新增用户身份认证能力。用户以邮箱+密码注册登录，通过 httpOnly Cookie 持久化会话，并支持邮件密码重置。

---

## 技术选型

| 层 | 选型 |
|---|---|
| 后端框架 | Python FastAPI |
| 数据库 | SQLite（via SQLAlchemy，ORM 异步模式） |
| 密码哈希 | bcrypt（passlib） |
| Token | JWT（python-jose），有效期 7 天 |
| Cookie | httpOnly + SameSite=Lax |
| 邮件发送 | SMTP（aiosmtplib） |
| 前端认证状态 | React Context（AuthContext） |
| 路由保护 | Next.js Middleware（服务端 JWT 校验） |

---

## 目录结构

```
backend/                          ← 新建
  main.py                         FastAPI 入口，CORS、路由注册
  database.py                     SQLite 连接 + SQLAlchemy async session
  models.py                       User、PasswordResetToken ORM 模型
  schemas.py                      Pydantic 请求/响应模型
  auth/
    router.py                     /auth/* 路由定义
    service.py                    注册、登录、重置业务逻辑
    dependencies.py               get_current_user FastAPI 依赖
    utils.py                      密码哈希、JWT 签发/校验、发邮件
  .env.example                    环境变量模板
  requirements.txt

frontend/src/                     ← 修改/新增
  middleware.ts                   路由保护（新增）
  context/AuthContext.tsx         全局用户状态（新增）
  app/login/page.tsx              真实登录表单（替换 stub）
  app/signup/page.tsx             真实注册表单（替换 stub）
  app/forgot-password/page.tsx    忘记密码页（新增）
  app/reset-password/page.tsx     重置密码页（新增）
  lib/api.ts                      全局加 credentials:'include'（修改）
```

---

## 数据模型

### users

| 字段 | 类型 | 约束 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| email | TEXT | NOT NULL, UNIQUE |
| hashed_password | TEXT | NOT NULL |
| created_at | DATETIME | DEFAULT now() |

### password_reset_tokens

| 字段 | 类型 | 约束 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | FK → users.id |
| token | TEXT | NOT NULL, UNIQUE |
| expires_at | DATETIME | NOT NULL（创建后 1 小时） |
| used | BOOLEAN | DEFAULT false |

---

## API 端点

| 方法 | 路径 | 请求体 | 响应 | 认证 |
|---|---|---|---|---|
| POST | `/auth/signup` | `{ email, password }` | `{ id, email }` + Set-Cookie | 无 |
| POST | `/auth/login` | `{ email, password }` | `{ id, email }` + Set-Cookie | 无 |
| POST | `/auth/logout` | — | `{ ok: true }` + Clear-Cookie | 无 |
| GET | `/auth/me` | — | `{ id, email }` | ✅ Cookie |
| POST | `/auth/forgot-password` | `{ email }` | `{ ok: true }`（静默） | 无 |
| POST | `/auth/reset-password` | `{ token, new_password }` | `{ ok: true }` | 无 |

### 错误码规范

| 场景 | HTTP 状态 |
|---|---|
| 邮箱已注册 | 400 |
| 邮箱或密码错误 | 401 |
| 密码不足 8 位 | 422 |
| JWT 无效或过期 | 401 |
| reset token 无效/过期/已用 | 400 |
| 邮箱不存在（forgot-password） | 200（静默，防枚举） |

---

## Cookie 设置

```
Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

- `HttpOnly`：JS 不可读，防 XSS
- `SameSite=Lax`：防 CSRF（GET 安全，POST 跨站被拒）
- `Max-Age=604800`：7 天（与 JWT 有效期一致）

---

## 密码重置流程

```
POST /auth/forgot-password { email }
  └─ 查找用户（不存在→静默返回 200，防枚举攻击）
  └─ 生成 secrets.token_hex(32) → 写入 password_reset_tokens
  └─ 发邮件：
       主题：「重置您的坐姿检测账户密码」
       正文：「点击以下链接（1小时内有效）：
              {RESET_BASE_URL}/reset-password?token={token}」

POST /auth/reset-password { token, new_password }
  └─ 查 token：不存在/已用/过期 → 400
  └─ new_password 长度 < 8 → 422
  └─ 更新 users.hashed_password
  └─ 标记 token.used = true
  └─ 返回 200
```

---

## 前端认证状态

### AuthContext

```ts
type User = { id: number; email: string }

type AuthContextValue = {
  user: User | null    // null = 未登录
  loading: boolean     // 首次 /auth/me 检查中
  login(email: string, password: string): Promise<void>
  signup(email: string, password: string): Promise<void>
  logout(): Promise<void>
}
```

`AuthProvider` 在 `layout.tsx` 包裹全局，挂载时自动调 `GET /auth/me`：
- Cookie 有效 → `user` 设为返回的用户信息
- 401 → `user = null`

### Next.js Middleware（路由保护）

```ts
// src/middleware.ts
export const config = {
  matcher: ['/app/:path*', '/history/:path*'],
}
// 服务端读取 Cookie 中的 token → 验证 JWT
// 无效 → redirect('/login')
```

### api.ts 修改

所有请求统一加 `credentials: 'include'`，浏览器跨域请求自动携带 Cookie：

```ts
const res = await fetch(`${BASE_URL}${path}`, {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...options,
})
```

---

## 环境变量（.env）

```
# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_ALGORITHM=HS256

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourmail@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=yourmail@gmail.com

# 重置链接基础 URL
RESET_BASE_URL=http://localhost:3000

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./posture.db
```

---

## CORS 配置

FastAPI 需要允许 Next.js 前端域名，并允许携带 Cookie：

```python
app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000"],
  allow_credentials=True,   # 必须为 True 才能携带 Cookie
  allow_methods=["*"],
  allow_headers=["*"],
)
```

---

## 未覆盖范围（后续子系统）

- 用量配额与免费试用绑定用户（子系统 3）
- 历史会话列表（子系统 4）
- 套餐购买与支付（子系统 5）
