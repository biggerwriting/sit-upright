# 部署指南

> 适用于将本项目部署到 **Netlify（静态托管）+ Supabase（后端）** 的完整流程。

---

## 架构与凭证分布

```
┌─────────────────────────────────────────────────────────────┐
│                      凭证存放位置                            │
├──────────────────────┬──────────────────────────────────────┤
│ 凭证                  │ 存放位置                              │
├──────────────────────┼──────────────────────────────────────┤
│ SUPABASE_SERVICE_ROLE│ Supabase Vault（函数环境变量）         │
│ _KEY（数据库完全权限） │ 绝不出现在代码、Netlify、本地 .env 以外│
├──────────────────────┼──────────────────────────────────────┤
│ SUPABASE_URL         │ Supabase Vault（同上）                 │
├──────────────────────┼──────────────────────────────────────┤
│ SUPABASE_FUNC_URL    │ posture-static-demo.html 顶部（明文）  │
│ WECHAT_ID            │ 非密钥，公开展示用                     │
├──────────────────────┼──────────────────────────────────────┤
│ scripts/.env 里的    │ 仅存本地，已加入 .gitignore            │
│ SERVICE_ROLE_KEY     │ 只用于本地运行 generate-token.js       │
└──────────────────────┴──────────────────────────────────────┘
```

**核心原则：`SUPABASE_SERVICE_ROLE_KEY` 永远不出现在 GitHub 仓库里。**

---

## 前置要求

| 工具 | 用途 | 获取 |
|------|------|------|
| GitHub 账号 | 托管代码 | github.com |
| Supabase 账号 | 数据库 + Edge Functions | supabase.com（免费） |
| Netlify 账号 | 静态页托管 | netlify.com（免费） |
| Supabase CLI | 部署函数 | `brew install supabase/tap/supabase` |
| Node.js ≥ 18 | 本地运行生成脚本 | nodejs.org |

---

## 第一步：Supabase 项目设置

### 1.1 创建项目

1. 登录 [supabase.com](https://supabase.com) → New project
2. 设置项目名称和数据库密码（记住密码备用）
3. 等待初始化完成（约 1 分钟）

### 1.2 获取项目信息

进入项目 → **Settings → API**，记录以下两个值：

```
Project URL:         https://xxxxxxxxxxxxxx.supabase.co
Project Ref:         xxxxxxxxxxxxxx          ← URL 中间那串字母
service_role key:    eyJhbGciOiJIUzI1NiIs...  ← 「妥善保管，不要外传」
anon key:            eyJhbGciOiJIUzI1NiIs...  ← 本项目不使用
```

> ⚠️ **`service_role key` 拥有完整数据库权限，等同于 root 密码。**  
> 不要截图、不要粘贴到聊天软件、不要写入代码文件。

### 1.3 执行数据库 Migration

进入项目 → **SQL Editor** → 新建查询，依次粘贴并执行：

**第一次执行（建表）：**
```sql
-- 文件：supabase/migrations/20260625_access_control.sql
-- 直接复制该文件全部内容粘贴执行
```

**第二次执行（原子函数）：**
```sql
-- 文件：supabase/migrations/20260625_increment_usage_fn.sql
-- 直接复制该文件全部内容粘贴执行
```

**第三次执行（关闭 RLS，否则脚本无法写入）：**
```sql
ALTER TABLE tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE trials DISABLE ROW LEVEL SECURITY;
```

执行完后在 **Table Editor** 里能看到 `trials` 和 `tokens` 两张表。

---

## 第二步：部署 Edge Functions

Edge Functions 运行在 Supabase 的服务器上，读取数据库用的 `service_role key` **通过 Supabase Vault 注入**，不需要写在代码里。

### 2.1 登录 Supabase CLI 并链接项目

```bash
supabase login                          # 浏览器授权
supabase link --project-ref xxxxxxxxxxxxxx   # 替换为你的 Project Ref
```

### 2.2 设置函数密钥（Supabase Vault）

> 这一步是整个流程中「最敏感」的操作。密钥通过 CLI 写入 Supabase 加密存储，**不会出现在代码仓库里**。

```bash
# 设置函数运行时所需的环境变量（两个）
supabase secrets set SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# 验证设置成功（只显示 key 名称，不显示值）
supabase secrets list
```

预期输出：
```
NAME                        DIGEST
SUPABASE_SERVICE_ROLE_KEY   sha256:...
SUPABASE_URL                sha256:...
```

### 2.3 部署三个函数

```bash
supabase functions deploy check-trial  --no-verify-jwt
supabase functions deploy check-token  --no-verify-jwt
supabase functions deploy update-usage --no-verify-jwt
```

> `--no-verify-jwt`：允许前端无需 API Key 直接调用，安全由函数内部逻辑保证。

### 2.4 验证函数部署成功

```bash
# 替换 xxxxxxxxxxxxxx 为你的 Project Ref
curl -s -X POST https://xxxxxxxxxxxxxx.supabase.co/functions/v1/check-trial \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"deploy-test-001"}' | python3 -m json.tool
```

期望返回：`{"status": "trial", "remainingSecs": 300}`

---

## 第三步：配置静态页

打开 `posture-static-demo.html`，修改顶部两行：

```js
// ── 部署配置（填写你的 Supabase 项目信息）────────────────────
const SUPABASE_FUNC_URL = 'https://xxxxxxxxxxxxxx.supabase.co/functions/v1'
const WECHAT_ID         = '你的微信号'
```

> 这两个值**不是密钥**：
> - `SUPABASE_FUNC_URL` 是公开的 HTTP 地址（函数以 `--no-verify-jwt` 部署）
> - `WECHAT_ID` 是付款引导用的联系方式，展示给用户看的

修改后 **提交到 GitHub**：

```bash
git add posture-static-demo.html
git commit -m "配置：填入 Supabase 函数地址和微信号"
git push
```

---

## 第四步：部署到 Netlify

### 4.1 连接 GitHub 仓库

1. 登录 [netlify.com](https://netlify.com) → **Add new site → Import an existing project**
2. 选择 GitHub → 授权 → 找到并选择本仓库

### 4.2 Build 设置

Netlify 会自动读取 `netlify.toml`，**Build settings 留空**即可：

| 字段 | 值 |
|------|---|
| Build command | （自动从 netlify.toml 读取，不用填）|
| Publish directory | （自动从 netlify.toml 读取，不用填）|

### 4.3 无需在 Netlify 设置 service_role key

Netlify 只托管静态文件，不运行后端逻辑。`service_role key` 已在 **Supabase Vault** 里，Netlify 完全接触不到这个值。

> ✅ Netlify 环境变量里**不需要**填任何 Supabase 密钥。

### 4.4 Deploy site

点击 **Deploy site**，等待 2–3 分钟构建完成。

构建日志中会看到：
```
$ cd frontend && npm install && ...
$ cp frontend/node_modules/@mediapipe/tasks-vision/wasm/* vendor/mediapipe/wasm/
$ sed -i "s|https://your-site.netlify.app|https://your-actual-site.netlify.app|g" index.html
```

### 4.5 获取并记录站点 URL

部署成功后，Netlify 会分配一个 URL，格式为 `https://xxx-yyy-zzz.netlify.app`。
你也可以在 **Domain settings** 里绑定自定义域名。

---

## 第五步：配置生成脚本（本地）

```bash
cd scripts
cp .env.example .env
```

用编辑器打开 `scripts/.env`，填入：

```bash
SUPABASE_URL=https://xxxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...   # 从 Supabase Settings → API 复制
SITE_URL=https://xxx-yyy-zzz.netlify.app              # 你的 Netlify 站点 URL
```

> `scripts/.env` 已加入 `.gitignore`，**不会被提交**。这个文件只存在你本地。

安装依赖：

```bash
npm install
```

测试生成一条链接：

```bash
node generate-token.js 60 1 "部署验证用"
```

把输出的链接粘贴到浏览器，确认能打开检测页面并显示配额。

---

## 验收清单

```
□ Supabase tables 已创建（trials / tokens 可见）
□ RLS 已关闭（trials / tokens 两张表）
□ supabase secrets list 能看到两个 key 名称
□ curl 测试 check-trial 返回 {"status":"trial","remainingSecs":300}
□ Netlify 部署成功，构建日志无报错
□ 打开 Netlify 站点 → 落地页正常显示
□ 点击「免费试用」→ 加载模型 → 开始检测正常
□ generate-token.js 生成链接 → 浏览器打开显示配额
□ 5 分钟试用结束 → 显示微信付款引导
```

---

## 环境变量完整参考

| 变量 | 值从哪里获取 | 存放位置 | 是否提交到 git |
|------|-------------|----------|---------------|
| `SUPABASE_URL` | Supabase Settings → API → Project URL | Supabase Vault（函数用）+ scripts/.env（脚本用）| ❌ 否 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → service_role | Supabase Vault（函数用）+ scripts/.env（脚本用）| ❌ 绝对否 |
| `SITE_URL` | Netlify 分配的站点 URL | scripts/.env | ❌ 否 |
| `SUPABASE_FUNC_URL` | 由 Project URL 拼出 | posture-static-demo.html 明文 | ✅ 是（非敏感）|
| `WECHAT_ID` | 你的微信号 | posture-static-demo.html 明文 | ✅ 是（非敏感）|

---

## 日常操作：收款后生成激活链接

```bash
cd scripts

# 格式：node generate-token.js <配额秒数> <有效天数> "<备注>"
node generate-token.js 10800  7  "套餐1 张三 ¥3  2026-06-25"   # 3小时   7天
node generate-token.js 216000 14 "套餐2 李四 ¥24 2026-06-25"   # 60小时 14天
node generate-token.js 1080000 30 "套餐3 王五 ¥30 2026-06-25"  # 300小时 30天
```

把输出链接发给用户，用户直接打开即可使用。

---

## 常见问题

**Q：Supabase CLI 登录后找不到我的项目？**  
`supabase link --project-ref YOUR_REF` 里的 Ref 在项目 URL 里：`https://supabase.com/dashboard/project/YOUR_REF`

**Q：函数部署成功但 curl 返回 401？**  
确认部署时加了 `--no-verify-jwt` 参数。

**Q：Netlify 构建失败，报 `cp: cannot stat`？**  
说明 `frontend/node_modules` 不存在，检查 `netlify.toml` 里 `cd frontend && npm install` 是否正确执行。查看构建日志定位具体报错行。

**Q：generate-token.js 报 `写入失败：row-level security`？**  
在 Supabase SQL Editor 执行：`ALTER TABLE tokens DISABLE ROW LEVEL SECURITY;`  
同时检查 `scripts/.env` 里用的是 `service_role` key 而不是 `anon` key（两者外观相同，勿混淆）。

**Q：部署后页面打开一直转圈？**  
打开浏览器 F12 → Console，看 `[checkAccess]` 报错。常见原因：`SUPABASE_FUNC_URL` 末尾多了斜杠，或函数未部署。
