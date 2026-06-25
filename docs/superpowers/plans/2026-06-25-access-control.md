# Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `posture-static-demo.html` 加入 5 分钟免费试用 + URL token 付费访问，后端用 Supabase Edge Functions，静态页托管到 Netlify。

**Architecture:** 静态 HTML 页面加载后先鉴权（试用或 token），鉴权通过才初始化 MediaPipe 并展示检测 UI；鉴权失败展示付款引导。三个 Supabase Edge Functions 处理试用/token 校验和用量上报，所有数据库凭证仅存于 Supabase Vault，前端不可见。

**Tech Stack:** Supabase Edge Functions (Deno)、@supabase/supabase-js v2、Node.js (scripts)、Netlify Static Hosting

## Global Constraints

- Edge Functions 用 Deno，导入路径 `https://esm.sh/@supabase/supabase-js@2`
- 所有函数部署参数加 `--no-verify-jwt`（公开可调用，无需前端携带 API Key）
- CORS 所有函数均返回 `Access-Control-Allow-Origin: *`，并响应 OPTIONS preflight
- `update-usage` 写入时上限为 `quota_secs`（防超出）
- HTML 配置区仅两行需填写：`SUPABASE_FUNC_URL` 和 `WECHAT_ID`
- `scripts/.env` 不提交 git（scripts/.gitignore 排除）
- Netlify publish directory 设为 `.`（项目根目录）
- 试用 5 分钟 = 300 秒，试用 IP 限流：10 分钟内同 IP 最多 3 条 trials 记录

---

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `supabase/migrations/20260625_access_control.sql` | 新增 | 建 trials / tokens 两张表 |
| `supabase/functions/check-trial/index.ts` | 新增 | 试用校验 + IP 限流 |
| `supabase/functions/check-token/index.ts` | 新增 | token 校验 |
| `supabase/functions/update-usage/index.ts` | 新增 | 用量上报 |
| `scripts/package.json` | 新增 | generate-token 脚本依赖 |
| `scripts/.env.example` | 新增 | 环境变量模板 |
| `scripts/.gitignore` | 新增 | 排除 .env |
| `scripts/generate-token.js` | 新增 | 生成激活链接 CLI |
| `netlify.toml` | 新增 | Netlify 部署配置 |
| `posture-static-demo.html` | 修改 | 鉴权流程 + 配额 UI |
| `README.md` | 修改 | 部署与使用文档 |

---

## Task 1：数据库 Migration SQL

**Files:**
- Create: `supabase/migrations/20260625_access_control.sql`

**Interfaces:**
- Produces: `trials` 表（device_id, ip, created_at, expires_at）、`tokens` 表（token, note, expires_at, quota_secs, used_secs）

- [ ] **Step 1: 创建目录并写 SQL 文件**

```bash
mkdir -p supabase/migrations
```

`supabase/migrations/20260625_access_control.sql`：

```sql
-- 试用记录：每设备 5 分钟免费
CREATE TABLE trials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text NOT NULL,
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX trials_device_id_idx ON trials (device_id);
CREATE INDEX trials_ip_idx        ON trials (ip);

-- 付费访问 token
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

- [ ] **Step 2: 在 Supabase 控制台执行**

打开 Supabase 项目 → SQL Editor → 粘贴上述 SQL → Run  
预期：左侧 Table Editor 出现 `trials` 和 `tokens` 两张表，各有对应列。

- [ ] **Step 3: 提交**

```bash
git add supabase/migrations/20260625_access_control.sql
git commit -m "新增：数据库 migration — trials 和 tokens 表"
```

---

## Task 2：Edge Function — check-trial

**Files:**
- Create: `supabase/functions/check-trial/index.ts`

**Interfaces:**
- Consumes: `trials` 表（Task 1）
- Produces: `POST /functions/v1/check-trial` → `{status:'trial'|'expired', remainingSecs?:number}`

- [ ] **Step 1: 创建目录并写函数**

```bash
mkdir -p supabase/functions/check-trial
```

`supabase/functions/check-trial/index.ts`：

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { deviceId } = await req.json()
  if (!deviceId) return json({ status: 'error', message: 'deviceId required' }, 400)

  // IP 限流：10 分钟内同一 IP 最多创建 3 条试用记录
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('trials')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', tenMinAgo)
  if ((count ?? 0) >= 3) return json({ status: 'error', message: 'rate limited' }, 429)

  // 查该设备最近一条试用记录
  const { data: trial } = await supabase
    .from('trials')
    .select('expires_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const now = Date.now()

  if (!trial) {
    // 首次访问：插入试用记录
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString()
    await supabase.from('trials').insert({ device_id: deviceId, ip, expires_at: expiresAt })
    return json({ status: 'trial', remainingSecs: 300 })
  }

  const expiresAt = new Date(trial.expires_at).getTime()
  if (now < expiresAt) {
    return json({ status: 'trial', remainingSecs: Math.floor((expiresAt - now) / 1000) })
  }

  return json({ status: 'expired' })
})
```

- [ ] **Step 2: 部署函数**

```bash
supabase functions deploy check-trial --no-verify-jwt
```

预期输出：`Deployed: check-trial`（或类似成功提示）

- [ ] **Step 3: 验证——首次请求（应返回 trial）**

```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-trial \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"test-device-001"}' | python3 -m json.tool
```

预期：`{"status": "trial", "remainingSecs": 300}`（秒数可能略小于 300）

- [ ] **Step 4: 验证——同 deviceId 再次请求（应返回剩余秒数）**

```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-trial \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"test-device-001"}' | python3 -m json.tool
```

预期：`{"status": "trial", "remainingSecs": <299 左右>}`

- [ ] **Step 5: 验证——缺少 deviceId（应返回 400）**

```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-trial \
  -H 'Content-Type: application/json' \
  -d '{}' | python3 -m json.tool
```

预期：HTTP 400，`{"status": "error", "message": "deviceId required"}`

- [ ] **Step 6: 提交**

```bash
git add supabase/functions/check-trial/index.ts
git commit -m "新增：Edge Function check-trial（试用校验 + IP 限流）"
```

---

## Task 3：Edge Function — check-token

**Files:**
- Create: `supabase/functions/check-token/index.ts`

**Interfaces:**
- Consumes: `tokens` 表（Task 1）
- Produces: `POST /functions/v1/check-token` → `{status:'valid'|'invalid'|'expired'|'exhausted', remainingSecs?:number}`

- [ ] **Step 1: 创建目录并写函数**

```bash
mkdir -p supabase/functions/check-token
```

`supabase/functions/check-token/index.ts`：

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { token } = await req.json()
  if (!token) return json({ status: 'invalid' })

  const { data: record } = await supabase
    .from('tokens')
    .select('expires_at, quota_secs, used_secs')
    .eq('token', token)
    .maybeSingle()

  if (!record) return json({ status: 'invalid' })

  if (Date.now() > new Date(record.expires_at).getTime()) {
    return json({ status: 'expired' })
  }

  const remainingSecs = record.quota_secs - record.used_secs
  if (remainingSecs <= 0) return json({ status: 'exhausted' })

  return json({ status: 'valid', remainingSecs })
})
```

- [ ] **Step 2: 部署函数**

```bash
supabase functions deploy check-token --no-verify-jwt
```

- [ ] **Step 3: 验证——无效 token（应返回 invalid）**

```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"00000000-0000-0000-0000-000000000000"}' | python3 -m json.tool
```

预期：`{"status": "invalid"}`

- [ ] **Step 4: 插入测试 token 并验证**

在 Supabase SQL Editor 执行：
```sql
INSERT INTO tokens (token, note, expires_at, quota_secs)
VALUES ('test-token-abc123', '测试用', now() + interval '1 hour', 60);
```

然后：
```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/check-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"test-token-abc123"}' | python3 -m json.tool
```

预期：`{"status": "valid", "remainingSecs": 60}`

- [ ] **Step 5: 提交**

```bash
git add supabase/functions/check-token/index.ts
git commit -m "新增：Edge Function check-token（token 校验）"
```

---

## Task 4：Edge Function — update-usage

**Files:**
- Create: `supabase/functions/update-usage/index.ts`

**Interfaces:**
- Consumes: `tokens` 表（Task 1）
- Produces: `POST /functions/v1/update-usage` → `{status:'valid'|'exhausted'|'invalid', remainingSecs:number}`

- [ ] **Step 1: 创建目录并写函数**

```bash
mkdir -p supabase/functions/update-usage
```

`supabase/functions/update-usage/index.ts`：

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { token, seconds } = await req.json()
  if (!token || typeof seconds !== 'number' || seconds < 0) {
    return json({ status: 'error', message: 'invalid params' }, 400)
  }

  const { data: record } = await supabase
    .from('tokens')
    .select('quota_secs, used_secs')
    .eq('token', token)
    .maybeSingle()

  if (!record) return json({ status: 'invalid', remainingSecs: 0 })

  // 上限保护：used_secs 不超过 quota_secs
  const newUsedSecs = Math.min(record.used_secs + seconds, record.quota_secs)
  await supabase.from('tokens').update({ used_secs: newUsedSecs }).eq('token', token)

  const remainingSecs = record.quota_secs - newUsedSecs
  return json({ status: remainingSecs > 0 ? 'valid' : 'exhausted', remainingSecs })
})
```

- [ ] **Step 2: 部署函数**

```bash
supabase functions deploy update-usage --no-verify-jwt
```

- [ ] **Step 3: 验证——上报 30 秒用量**

（使用 Task 3 插入的测试 token）
```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/update-usage \
  -H 'Content-Type: application/json' \
  -d '{"token":"test-token-abc123","seconds":30}' | python3 -m json.tool
```

预期：`{"status": "valid", "remainingSecs": 30}`

再上报 30 秒：
```bash
curl -s -X POST https://YOUR_PROJECT.supabase.co/functions/v1/update-usage \
  -H 'Content-Type: application/json' \
  -d '{"token":"test-token-abc123","seconds":30}' | python3 -m json.tool
```

预期：`{"status": "exhausted", "remainingSecs": 0}`

- [ ] **Step 4: 提交**

```bash
git add supabase/functions/update-usage/index.ts
git commit -m "新增：Edge Function update-usage（用量上报，含上限保护）"
```

---

## Task 5：Token 生成脚本

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/.env.example`
- Create: `scripts/.gitignore`
- Create: `scripts/generate-token.js`

**Interfaces:**
- Consumes: `tokens` 表（Task 1）、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SITE_URL`（来自 `scripts/.env`）
- Produces: 终端打印激活链接

- [ ] **Step 1: 创建 scripts/ 下的支撑文件**

`scripts/package.json`：
```json
{
  "name": "posture-scripts",
  "version": "1.0.0",
  "description": "激活链接生成工具",
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "dotenv": "^16.0.0"
  }
}
```

`scripts/.env.example`：
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（在 Supabase → Settings → API → service_role 里找）
SITE_URL=https://your-site.netlify.app
```

`scripts/.gitignore`：
```
.env
node_modules/
```

- [ ] **Step 2: 写生成脚本**

`scripts/generate-token.js`：
```js
#!/usr/bin/env node
// 用法：node generate-token.js <配额秒数> <有效天数> "<备注>"
// 示例：node generate-token.js 7200 30 "张三 ¥29 2026-06-25"

require('dotenv').config({ path: __dirname + '/.env' })
const { createClient } = require('@supabase/supabase-js')
const { randomUUID }   = require('crypto')

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SITE_URL) {
  console.error('❌ 缺少环境变量，请先复制 .env.example 为 .env 并填写')
  process.exit(1)
}

const [,, quotaArg = '3600', daysArg = '30', note = ''] = process.argv
const quotaSecs = parseInt(quotaArg)
const days      = parseInt(daysArg)

if (isNaN(quotaSecs) || isNaN(days)) {
  console.error('❌ 用法：node generate-token.js <配额秒数> <有效天数> "<备注>"')
  process.exit(1)
}

;(async () => {
  const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const token     = randomUUID()
  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()

  const { error } = await supabase.from('tokens').insert({
    token, note, expires_at: expiresAt, quota_secs: quotaSecs,
  })
  if (error) { console.error('❌ 写入失败：', error.message); process.exit(1) }

  const url  = `${SITE_URL}/posture-static-demo.html?token=${token}`
  const line = '─'.repeat(64)
  console.log(`\n✅ Token 生成成功`)
  console.log(line)
  console.log(`配额：${quotaSecs} 秒（${Math.round(quotaSecs / 60)} 分钟）`)
  console.log(`有效期至：${new Date(expiresAt).toLocaleString('zh-CN')}`)
  console.log(`备注：${note || '（无）'}`)
  console.log(line)
  console.log('访问链接（发给用户）：')
  console.log(url)
  console.log(line + '\n')
})()
```

- [ ] **Step 3: 安装依赖并测试脚本**

```bash
cd scripts
cp .env.example .env   # 填入真实值后：
npm install
node generate-token.js 60 1 "测试用"
```

预期输出：
```
✅ Token 生成成功
────────────────────────────────────────────────────────────────
配额：60 秒（1 分钟）
有效期至：2026/6/26 ...
备注：测试用
────────────────────────────────────────────────────────────────
访问链接（发给用户）：
https://your-site.netlify.app/posture-static-demo.html?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
────────────────────────────────────────────────────────────────
```

同时在 Supabase tokens 表里能看到这条记录。

- [ ] **Step 4: 提交**

```bash
cd ..
git add scripts/package.json scripts/.env.example scripts/.gitignore scripts/generate-token.js
git commit -m "新增：激活链接生成脚本 scripts/generate-token.js"
```

---

## Task 6：Netlify 配置

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: 写配置文件**

`netlify.toml`：
```toml
[build]
  publish = "."     # 项目根目录作为静态资源目录

# 安全响应头
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

# WASM 文件必须带正确 MIME 类型，否则浏览器拒绝执行
[[headers]]
  for = "/*.wasm"
  [headers.values]
    Content-Type = "application/wasm"
```

- [ ] **Step 2: 提交**

```bash
git add netlify.toml
git commit -m "新增：netlify.toml（静态托管配置 + WASM MIME 修正）"
```

---

## Task 7：HTML — 鉴权流程（状态机 + 覆盖层 UI）

**Files:**
- Modify: `posture-static-demo.html`

**Interfaces:**
- Consumes: `check-trial`（Task 2）、`check-token`（Task 3）的 HTTP 接口
- Produces:
  - `getDeviceId(): string`
  - `showState(state: 'checking'|'ready'|'paywall'|'token-invalid'): void`
  - `checkAccess(): Promise<void>`（设置 `accessMode`、`quotaSecs`、`activeToken`）
  - 全局变量：`accessMode: 'trial'|'token'|null`、`quotaSecs: number`、`activeToken: string|null`

- [ ] **Step 1: 在 `<style>` 块末尾添加覆盖层和配额条 CSS**

在 `</style>` 前插入：

```css
  /* ── 鉴权覆盖层 ── */
  #auth-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: #0f172a;
    z-index: 200;
    align-items: center;
    justify-content: center;
  }
  #auth-overlay.show { display: flex; }
  .auth-card {
    background: #1e293b;
    border-radius: 16px;
    padding: 32px 28px;
    width: min(420px, 90vw);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .auth-card h2 { font-size: 1.3rem; }
  .auth-card p  { color: #94a3b8; font-size: .9rem; line-height: 1.6; }
  .auth-card .wechat-id {
    font-size: 1.1rem;
    font-weight: 700;
    color: #4ade80;
    letter-spacing: .05em;
  }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid #334155;
    border-top-color: #60a5fa;
    border-radius: 50%;
    animation: spin .8s linear infinite;
    margin: 0 auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── 配额条 ── */
  #quota-bar {
    display: none;
    font-size: .8rem;
    color: #94a3b8;
    text-align: center;
    padding: 4px 0;
  }
  #quota-bar.show { display: block; }
  #quota-bar.trial-mode { color: #facc15; }
  #quota-bar.low        { color: #f87171; font-weight: 600; }
```

- [ ] **Step 2: 在 `<body>` 顶部添加覆盖层和配额条 HTML**

在 `<h1>🪑 坐姿检测</h1>` 后、`<div id="cam-wrap">` 前插入：

```html
<!-- 配额条 -->
<div id="quota-bar"></div>

<!-- 鉴权覆盖层 -->
<div id="auth-overlay" class="show">
  <!-- checking：加载中 -->
  <div id="state-checking" class="auth-card">
    <div class="spinner"></div>
    <p>正在验证访问权限…</p>
  </div>
  <!-- paywall：试用结束 -->
  <div id="state-paywall" class="auth-card" style="display:none">
    <h2>⏱️ 免费试用已结束</h2>
    <p>加微信，转账后发给你访问链接：</p>
    <p class="wechat-id" id="paywall-wechat"></p>
    <p style="font-size:.75rem;color:#475569">
      购买后你会收到一条专属链接，打开即可继续使用
    </p>
  </div>
  <!-- token-invalid：链接无效/过期/用完 -->
  <div id="state-invalid" class="auth-card" style="display:none">
    <h2>❌ 无法访问</h2>
    <p id="invalid-msg"></p>
    <p style="font-size:.75rem;color:#475569">
      需要新链接请联系：<span id="invalid-wechat" style="color:#4ade80;font-weight:700"></span>
    </p>
  </div>
</div>
```

- [ ] **Step 3: 在 `<script>` 顶部（`MODEL_PATH` 常量之前）插入配置区**

在 `const MODEL_PATH` 这一行之前插入：

```js
// ── 部署配置（填写你的 Supabase 项目 URL 和微信号）────────────
const SUPABASE_FUNC_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1'
const WECHAT_ID         = 'your_wechat_id'
// ────────────────────────────────────────────────────────────────
```

- [ ] **Step 4: 在 DOM 引用区末尾添加新元素引用**

在 `const overlay = ...` 这一行之后追加：

```js
const authOverlay   = document.getElementById('auth-overlay')
const stateChecking = document.getElementById('state-checking')
const statePaywall  = document.getElementById('state-paywall')
const stateInvalid  = document.getElementById('state-invalid')
const quotaBar      = document.getElementById('quota-bar')
```

- [ ] **Step 5: 在状态变量区添加鉴权状态变量**

在 `let lastIsHunch` 这一行之后插入：

```js
// 鉴权状态
let accessMode  = null   // 'trial' | 'token'
let quotaSecs   = 0      // 当前剩余秒数
let activeToken = null   // URL token（token 模式时有值）
let reportTimer = null   // 每 30s 上报用量的定时器句柄
```

- [ ] **Step 6: 在「5. 语音提醒」之前插入鉴权函数**

```js
// ──────────────────────────────────────────────────────────────
// 5. 鉴权与状态管理
// ──────────────────────────────────────────────────────────────

// 取/建设备 ID（localStorage UUID，刷新不重置）
function getDeviceId() {
  let id = localStorage.getItem('posture_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('posture_device_id', id) }
  return id
}

// 切换覆盖层显示的子状态
function showAuthState(state) {
  ;[stateChecking, statePaywall, stateInvalid].forEach(el => el.style.display = 'none')
  if (state === 'checking') stateChecking.style.display = ''
  if (state === 'paywall')  statePaywall.style.display  = ''
  if (state === 'invalid')  stateInvalid.style.display  = ''
}

// 显示/隐藏整个覆盖层
function showOverlay(state) {
  showAuthState(state)
  authOverlay.classList.add('show')
}
function hideOverlay() {
  authOverlay.classList.remove('show')
}

// 更新配额条文字和样式
function updateQuotaBar() {
  const m   = Math.floor(quotaSecs / 60)
  const s   = quotaSecs % 60
  const txt = m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
  const label = accessMode === 'trial' ? '⏱ 试用剩余' : '⏳ 配额剩余'
  quotaBar.textContent = `${label}：${txt}`
  quotaBar.className   = 'show' + (accessMode === 'trial' ? ' trial-mode' : '') +
                         (quotaSecs <= 30 ? ' low' : '')
}

// 鉴权主流程：检查 URL token 或试用状态
async function checkAccess() {
  showOverlay('checking')

  const urlToken = new URLSearchParams(location.search).get('token')

  try {
    if (urlToken) {
      // ── Token 模式 ──
      const res = await fetch(`${SUPABASE_FUNC_URL}/check-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: urlToken }),
      }).then(r => r.json())

      if (res.status === 'valid') {
        accessMode  = 'token'
        activeToken = urlToken
        quotaSecs   = res.remainingSecs
        hideOverlay()
        updateQuotaBar()
      } else {
        document.getElementById('paywall-wechat').textContent  = WECHAT_ID
        document.getElementById('invalid-wechat').textContent  = WECHAT_ID
        document.getElementById('invalid-msg').textContent =
          res.status === 'expired'   ? '链接已过期，请联系我购买新套餐。' :
          res.status === 'exhausted' ? '配额已用完，请联系我购买新套餐。' :
                                       '链接无效，请检查链接是否完整。'
        showOverlay('invalid')
      }
    } else {
      // ── 试用模式 ──
      const deviceId = getDeviceId()
      const res = await fetch(`${SUPABASE_FUNC_URL}/check-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      }).then(r => r.json())

      if (res.status === 'trial') {
        accessMode = 'trial'
        quotaSecs  = res.remainingSecs
        hideOverlay()
        updateQuotaBar()
      } else {
        document.getElementById('paywall-wechat').textContent = WECHAT_ID
        showOverlay('paywall')
      }
    }
  } catch {
    // 网络错误时降级：允许访问但不计配额
    accessMode = 'trial'
    quotaSecs  = 300
    hideOverlay()
    updateQuotaBar()
  }
}
```

- [ ] **Step 7: 将 `init()` 底部的调用改为先鉴权再初始化 MediaPipe**

找到文件最底部的 `init()` 调用，将：
```js
init()
```
替换为：
```js
checkAccess().then(() => init())
```

- [ ] **Step 8: 手动验证覆盖层**

```bash
python3 -m http.server 8080
```

打开 `http://localhost:8080/posture-static-demo.html`：
- 若 `SUPABASE_FUNC_URL` 已填真实值：短暂转圈后覆盖层消失，顶部出现黄色"⏱ 试用剩余：5 分 0 秒"
- 若 `SUPABASE_FUNC_URL` 仍为占位符：网络失败后降级，覆盖层消失，顶部出现配额条（降级行为正常）

打开 `http://localhost:8080/posture-static-demo.html?token=00000000-0000-0000-0000-000000000000`：
- 覆盖层显示"❌ 无法访问 — 链接无效"

- [ ] **Step 9: 提交**

```bash
git add posture-static-demo.html
git commit -m "新增：静态页鉴权流程——覆盖层状态机 + checkAccess()"
```

---

## Task 8：HTML — 配额倒计时 + 用量上报

**Files:**
- Modify: `posture-static-demo.html`

**Interfaces:**
- Consumes: `accessMode`、`quotaSecs`、`activeToken`（Task 7）；`update-usage`（Task 4）HTTP 接口
- Produces: 检测期间每秒配额递减；每 30s 上报 token 用量；配额归零时自动停止

- [ ] **Step 1: 在 `tick()` 函数中加入配额倒计时和归零处理**

找到 `tick()` 函数内「更新数字」注释之前，在 `renderTimeline(timelineEl, segments)` 这一行**之后**追加：

```js
  // 配额倒计时（试用和 token 模式都递减）
  if (running && quotaSecs > 0) {
    quotaSecs--
    updateQuotaBar()
    if (quotaSecs === 0) {
      stopDetection()
      document.getElementById('paywall-wechat').textContent = WECHAT_ID
      showOverlay('paywall')
    }
  }
```

- [ ] **Step 2: 在 `startDetection()` 中加入用量上报定时器**

找到 `startDetection()` 内 `tickTimer = setInterval(tick, 1000)` 这一行**之后**插入：

```js
  // 仅 token 模式每 30s 上报用量到后端
  if (accessMode === 'token' && activeToken) {
    reportTimer = setInterval(async () => {
      const res = await fetch(`${SUPABASE_FUNC_URL}/update-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activeToken, seconds: 30 }),
      }).then(r => r.json()).catch(() => null)
      if (res?.status === 'exhausted') {
        stopDetection()
        document.getElementById('paywall-wechat').textContent = WECHAT_ID
        showOverlay('paywall')
      }
    }, 30_000)
  }
```

- [ ] **Step 3: 在 `stopDetection()` 中清除上报定时器**

找到 `stopDetection()` 内 `if (tickTimer)` 这一行**之后**插入：

```js
  if (reportTimer) { clearInterval(reportTimer); reportTimer = null }
```

- [ ] **Step 4: 手动验证配额倒计时**

1. 设置 `checkAccess()` 中试用 fallback 的 `quotaSecs = 10`（临时改为 10 秒方便测试）
2. `python3 -m http.server 8080`，打开页面
3. 点「开始检测」
4. 观察顶部配额条每秒递减，10 秒后自动停止，覆盖层显示 paywall
5. 恢复 `quotaSecs = 300`

- [ ] **Step 5: 提交**

```bash
git add posture-static-demo.html
git commit -m "新增：配额倒计时 + 每 30s 用量上报（token 模式）"
```

---

## Task 9：README 更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在「静态演示页」章节末尾（注意事项表格之后）追加部署章节**

在最后一个注意事项行（`| **替换提示音** ...`）之后追加：

```markdown
### 付费访问与部署

#### 架构概览

```
用户浏览器 → Netlify（静态页）→ Supabase Edge Functions → Supabase DB
```

#### 一次性部署步骤

**1. 准备 Supabase 项目**

1. 在 [supabase.com](https://supabase.com) 新建项目（免费）
2. SQL Editor → 粘贴并执行 `supabase/migrations/20260625_access_control.sql`
3. Settings → API → 复制 Project URL 和 `service_role` Key

**2. 部署 Edge Functions**

```bash
# 安装 Supabase CLI（若未安装）
brew install supabase/tap/supabase

# 登录
supabase login

# 部署三个函数
supabase functions deploy check-trial  --no-verify-jwt --project-ref YOUR_PROJECT_REF
supabase functions deploy check-token  --no-verify-jwt --project-ref YOUR_PROJECT_REF
supabase functions deploy update-usage --no-verify-jwt --project-ref YOUR_PROJECT_REF
```

**3. 配置静态页**

编辑 `posture-static-demo.html` 顶部两行：

```js
const SUPABASE_FUNC_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1'
const WECHAT_ID         = 'your_wechat_id'
```

**4. 部署到 Netlify**

1. 将代码推送到 GitHub
2. Netlify → Add new site → Import from Git → 选择仓库
3. Build settings：Build command 留空，Publish directory 填 `.`
4. Deploy site

**5. 配置生成脚本**

```bash
cd scripts
cp .env.example .env   # 填入 Supabase URL、service_role key、Netlify 站点 URL
npm install
```

#### 日常操作：收款后生成激活链接

```bash
cd scripts
# node generate-token.js <配额秒数> <有效天数> "<备注>"
node generate-token.js 7200 30 "张三 ¥29 2026-06-25"
```

输出的链接直接发给用户即可，用户打开链接就能使用。

#### 访问控制逻辑

| 情况 | 行为 |
|------|------|
| 首次访问（无 token） | 5 分钟免费试用，刷新不重置 |
| 试用结束 | 显示微信付款引导 |
| 带有效 token 访问 | 显示剩余配额，可正常检测 |
| Token 过期或用完 | 提示联系购买 |
| 后台超 5 分钟 | 定时器节流，检测变慢（同现有说明）|
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "文档：添加付费访问部署说明和日常操作指南"
```

---

## 自检清单

- [x] 数据库表结构与 Edge Function 查询字段一致（device_id、token 等）
- [x] `update-usage` 有 `used_secs` 上限保护（min(used+seconds, quota)）
- [x] `check-trial` IP 限流使用 `x-forwarded-for` Header（Supabase 自动注入）
- [x] 所有 Edge Function 响应 OPTIONS preflight（CORS）
- [x] `reportTimer` 在 `stopDetection()` 中被清除
- [x] 配额归零时同时停止检测并显示 paywall
- [x] 网络错误时 `checkAccess()` 降级为 300 秒试用（不阻断正常使用）
- [x] `scripts/.env` 已加入 `.gitignore`，不提交数据库凭证
- [x] `netlify.toml` 包含 `.wasm` 的正确 MIME 类型头
