# 访问控制与变现设计文档

**日期：** 2026-06-25  
**状态：** 已批准  
**范围：** `posture-static-demo.html` 鉴权流程 + Supabase 后端 + Netlify 部署

---

## 一、商业模式

- **免费试用：** 首次访问设备可用 5 分钟，刷新不重置（记录存数据库）
- **付费激活：** 线下微信收款，收款后运行 CLI 脚本生成带 token 的访问链接发给用户
- **托管：** Netlify 静态托管（免费）+ Supabase Edge Functions（免费额度）

---

## 二、页面状态机

```
页面加载
  ├─ 取/建 deviceId（localStorage UUID）
  ├─ URL 含 ?token=
  │     是 → check-token
  │           ├─ valid     → [ready]        显示剩余配额，可开始检测
  │           ├─ expired   → [token-invalid] "链接已过期，请重新购买"
  │           ├─ exhausted → [token-invalid] "配额已用完，请重新购买"
  │           └─ invalid   → [token-invalid] "链接无效"
  │     否 → check-trial
  │           ├─ trial   → [ready]   显示"试用剩余 Xs"，可开始检测
  │           └─ expired → [paywall] 展示微信付款引导
  │
  [running] 检测中，每 30s 调 update-usage（token 模式）
            配额归零 → 自动停止 → [paywall]
```

**五个状态：**

| 状态 | 显示内容 |
|------|---------|
| `checking` | 转圈加载动画 |
| `ready` | 正常检测页，顶部显示剩余配额/试用时间 |
| `running` | 同 ready，检测进行中 |
| `paywall` | 付款引导（微信号 + 付款说明） |
| `token-invalid` | 错误提示（链接无效/已过期/已用完）|

---

## 三、数据库（Supabase PostgreSQL）

```sql
-- 试用记录：每设备 5 分钟
CREATE TABLE trials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text NOT NULL,
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX trials_device_id_idx ON trials (device_id);
CREATE INDEX trials_ip_idx ON trials (ip);

-- 付费 token
CREATE TABLE tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text UNIQUE NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  quota_secs int NOT NULL DEFAULT 3600,
  used_secs  int NOT NULL DEFAULT 0
);
CREATE INDEX tokens_token_idx ON tokens (token);
```

---

## 四、Edge Functions

所有函数部署为 `--no-verify-jwt`（公开可调），无需前端携带 API Key。  
数据库操作使用 `SUPABASE_SERVICE_ROLE_KEY`（仅存于 Supabase Vault，前端不可见）。

### 4.1 check-trial

**入参：** `{ deviceId: string }`  
**响应：** `{ status: 'trial' | 'expired', remainingSecs?: number }`

**逻辑：**
1. IP 限流：同一 IP 在 10 分钟内超过 3 条 trials 记录 → 返回 429
2. 查 trials 表找最新一条 `device_id` 匹配记录
3. 无记录 → 插入新记录，返回 `{ status: 'trial', remainingSecs: 300 }`
4. 记录未过期 → 返回剩余秒数
5. 记录已过期 → 返回 `{ status: 'expired' }`

### 4.2 check-token

**入参：** `{ token: string }`  
**响应：** `{ status: 'valid' | 'invalid' | 'expired' | 'exhausted', remainingSecs?: number }`

**逻辑：**
1. 查 tokens 表
2. 无记录 → `invalid`
3. `expires_at < now()` → `expired`
4. `used_secs >= quota_secs` → `exhausted`
5. 否则 → `valid`，返回 `quota_secs - used_secs`

### 4.3 update-usage

**入参：** `{ token: string, seconds: number }`  
**响应：** `{ status: 'valid' | 'exhausted', remainingSecs: number }`

**逻辑：**
1. 查 tokens 表
2. 无记录 → 返回 `invalid`（忽略，前端不处理）
3. `used_secs += seconds`，写回数据库
4. 返回新的剩余秒数

---

## 五、前端修改（posture-static-demo.html）

**新增配置区（顶部，两行需填写）：**
```js
const SUPABASE_FUNC_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1'
const WECHAT_ID = 'your_wechat_id'
```

**新增 UI 元素：**
- 状态覆盖层（checking / paywall / token-invalid 时全屏显示）
- 配额条：顶部一行，显示"剩余 Xs 试用"或"剩余 Xm Xs 配额"
- paywall 页：展示微信号 + 付款说明文字

**新增 JS 逻辑：**
- `getDeviceId()` — localStorage 取/建 UUID
- `checkAccess()` — 异步，走状态机，决定初始状态
- `reportUsage()` — 每 30s 调用 update-usage（token 模式才上报）
- 配额倒计时：每秒递减，归零时自动停止检测

---

## 六、Token 生成脚本

```bash
# 用法
node scripts/generate-token.js <配额秒数> <有效天数> "<备注>"

# 示例：生成 2 小时配额、30 天有效期的链接
node scripts/generate-token.js 7200 30 "张三 ¥29 2026-06-25"

# 输出
✅ Token 生成成功
────────────────────────────────────────────────────────────
访问链接：
https://your-site.netlify.app/posture-static-demo.html?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
────────────────────────────────────────────────────────────
```

脚本读取 `scripts/.env`（不提交），包含：
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SITE_URL=https://your-site.netlify.app
```

---

## 七、文件清单

| 文件 | 操作 |
|------|------|
| `posture-static-demo.html` | 修改：加鉴权流程 + 配额 UI |
| `netlify.toml` | 新增：Netlify 部署配置 |
| `scripts/generate-token.js` | 新增：激活链接生成 CLI |
| `scripts/.env.example` | 新增：环境变量模板 |
| `supabase/migrations/20260625_access_control.sql` | 新增：建表 SQL |
| `supabase/functions/check-trial/index.ts` | 新增 |
| `supabase/functions/check-token/index.ts` | 新增 |
| `supabase/functions/update-usage/index.ts` | 新增 |
| `README.md` | 修改：部署文档 |

---

## 八、部署步骤（一次性）

1. Supabase 控制台 → SQL Editor → 运行 migration SQL
2. `supabase functions deploy check-trial --no-verify-jwt`
3. `supabase functions deploy check-token --no-verify-jwt`
4. `supabase functions deploy update-usage --no-verify-jwt`
5. 填写 `posture-static-demo.html` 顶部两行配置
6. Netlify → New site from Git → publish directory 设为 `.`（项目根目录）
7. 推送代码，Netlify 自动部署

---

## 九、安全说明

| 风险 | 缓解措施 |
|------|---------|
| 前端可见 Function URL | 函数只执行预定逻辑，无数据库凭证暴露 |
| check-trial 垃圾数据 | IP 限流：10 分钟内同 IP 最多 3 条 |
| Token 暴力猜测 | UUID v4 有 122 位熵，计算不可行 |
| 试用重置 | 清 localStorage 可重置；接受此局限 |
