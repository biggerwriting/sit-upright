# PostureMonitor · 实时坐姿检测

通过摄像头实时检测坐姿，弓腰超过 3 秒自动提醒。

---

## 运行效果

- 🟢 **绿色边框** — 坐姿良好
- 🔴 **红色边框** — 检测到弓腰，持续计时
- 超过 3 秒未纠正 → 终端滚动提示

---

## 快速开始

### 前置要求

| 工具 | 版本 | 安装 |
|---|---|---|
| Python | ≥ 3.10 | [python.org](https://www.python.org) |
| uv | 任意 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| 摄像头 | — | 内置或外接均可 |

### 所需文件

```
check_posture.py          ← 主程序
pose_landmarker_lite.task ← AI 模型（约 5MB，没有会自动下载）
```

### 运行

```bash
uv run check_posture.py
```

首次运行会自动安装依赖（约 200MB），之后换目录运行直接复用缓存，无需重新下载。

---

## 依赖说明

脚本头部已锁定版本，保证任何时间、任何目录运行结果一致：

```
opencv-python==4.13.0.92   # 摄像头采集 + 画面渲染
mediapipe==0.10.35         # Google 姿态关键点检测
numpy==2.4.6               # 数值计算
```

> **为什么要锁版本？**  
> 不锁版本时，uv 每次都会解析最新版本。如果包发布了新版本，缓存就失效，需要重新下载。锁定版本后，缓存永久命中。

---

## 操作说明

| 操作 | 效果 |
|---|---|
| 摆正坐姿 | 边框变绿 |
| 按 `Q` 或 `ESC` | 退出程序 |
| 点击窗口关闭按钮 | 退出程序 |

确保摄像头能看到你的**头部和肩膀**，检测效果最佳。

---

## 常见问题

**首次运行很慢？**  
正常现象。uv 需要下载并安装依赖包（约 200MB），之后换目录运行瞬间完成。

**提示找不到模型文件？**  
开发模式下会自动从 Google Storage 下载 `pose_landmarker_lite.task`（约 5MB）。  
若网络受限，可手动下载后放在脚本同目录：
```
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
```

**换了目录，模型文件又要下载？**  
模型文件存在脚本同目录，切换目录时需要一并复制：
```bash
cp /原目录/pose_landmarker_lite.task /新目录/
```

**检测不到人？**  
画面显示 `No person detected`，说明光线不足或摄像头角度问题，调整后自动恢复。

---

## 打包为 macOS App

如需打包成独立 `.app`，参见 [INSTALL.md](INSTALL.md)。

---

## 静态演示页（无需后端）

`posture-static-demo.html` 是一个**零依赖、纯前端**的坐姿检测页面，不需要启动任何后端或 Node 服务，适合快速体验或离线演示。

### 功能

- 实时摄像头坐姿推理（MediaPipe Pose Landmarker，WASM 在浏览器内运行）
- 骨架关键点可视化叠加
- 每秒统计好/坏坐姿秒数 + 连续弓腰警告
- **语音提醒**：连续弓腰 5 秒播放 MP3 提示音，保持弓腰状态每 30 秒重复一次，坐正后重置
- 坐姿时间轴（色块显示好/坏切换）
- 停止后弹出本次检测报告（时长、优秀率）

### 文件结构

```
good-sit/
├── posture-static-demo.html     ← 演示页（入口）
├── pose_landmarker_lite.task    ← 姿态模型（5.5 MB）
├── audio/
│   └── posture-alert.mp3        ← 语音提醒音频
└── vendor/
    └── mediapipe/
        ├── vision_bundle.mjs    ← 推理库（从 node_modules 复制）
        └── wasm/                ← WASM 运行时（6 个文件，约 33 MB）
```

> `vendor/` 目录需手动生成（见下方初始化步骤），已加入 `.gitignore` 不提交。

### 初始化 vendor 目录

首次使用前，在项目根目录执行一次（需已安装前端依赖 `npm install`）：

```bash
mkdir -p vendor/mediapipe/wasm

# 复制推理库
cp frontend/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs vendor/mediapipe/

# 复制 WASM 运行时
cp frontend/node_modules/@mediapipe/tasks-vision/wasm/* vendor/mediapipe/wasm/
```

### 启动

```bash
# 在项目根目录起一个本地 HTTP 服务器（Python 自带）
python3 -m http.server 8080
```

然后在浏览器打开：**`http://localhost:8080/posture-static-demo.html`**

> ⚠️ 必须通过 `http://localhost` 访问，不能直接双击文件（`file://` 协议无法申请摄像头权限）。

### 注意事项

| 事项 | 说明 |
|------|------|
| **后台标签页** | 检测循环基于 `setInterval(200ms)`，切换到其他标签页后仍可继续运行（浏览器最多节流至每秒 1 次，对 1s 粒度的坐姿统计足够）。后台超过 5 分钟且无音频时，部分浏览器会将定时器进一步节流至每分钟 1 次，此时检测基本失效。 |
| **语音首次触发** | 浏览器要求用户至少与页面有过一次交互（如点击「开始检测」）才允许播放音频；首次打开页面后直接自动播放会被拒绝。 |
| **语音重复间隔** | 连续弓腰满 5 秒首次响铃，之后保持弓腰每隔 30 秒再次响铃；坐正后计数重置，下次弓腰重新从 5 秒开始计。 |
| **替换提示音** | 将 `audio/posture-alert.mp3` 替换成任意 MP3 文件即可自定义提示音，无需修改代码。 |

# 提高依赖库下载速度
换清华镜像源

配置文件：~/.config/uv/uv.toml（全局生效，所有项目共享）

[[index]]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
default = true

---
常用国内镜像对比

┌─────────┬─────────────────────────────────────────────────────┬─────────┐
│  镜像   │                        地址                         │ 推荐程  │
│         │                                                     │   度    │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 清华大  │ https://pypi.tuna.tsinghua.edu.cn/simple            │ ⭐⭐⭐  │
│ 学      │                                                     │ 最稳定  │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 阿里云  │ https://mirrors.aliyun.com/pypi/simple/             │ ⭐⭐⭐  │
│         │                                                     │ 速度快  │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 腾讯云  │ https://mirrors.cloud.tencent.com/pypi/simple/      │ ⭐⭐    │
├─────────┼─────────────────────────────────────────────────────┼─────────┤
│ 华为云  │ https://repo.huaweicloud.com/repository/pypi/simple/ │ ⭐⭐    │
└─────────┴─────────────────────────────────────────────────────┴─────────┘

换镜像只需改那一行 url 即可。

---
其他提速方式

临时指定（不改配置文件，单次生效）：
UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ uv run check_posture.py

项目级配置（只对当前项目生效，放在项目根目录）：
## 在项目目录建 uv.toml，内容同上
echo '[[index]]
url = "https://pypi.tuna.tsinghua.edu.cn/simple"
default = true' > uv.toml


# 添加用户登录模块


环境启动

终端 1 — 后端：
cd /Users/tongqianwen/ExpProjects/learn/good-sit/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

终端 2 — 前端：
cd /Users/tongqianwen/ExpProjects/learn/good-sit/frontend
npm run dev

---
验收清单

1. 路由保护（Middleware）

- [ ] 浏览器直接访问 http://localhost:3000/app → 自动跳转到 /login
- [ ] 直接访问 http://localhost:3000/history → 自动跳转到 /login
- [ ] 直接访问 http://localhost:3000（落地页）→ 正常显示，不跳转

2. 注册

- [ ] 访问 /signup，填写邮箱 + 密码（≥8 位）→ 注册成功，跳转到 /app
- [ ] 再用同一邮箱注册 → 显示"该邮箱可能已被注册"错误
- [ ] 密码少于 8 位 → 浏览器原生阻止提交（minLength 校验）

3. 登录 / 登出

- [ ] 注册后刷新 /app → 仍正常显示（Cookie 持久化）
- [ ] 访问 /login，用刚注册的邮箱+密码登录 → 跳转到 /app
- [ ] 输入错误密码 → 显示"邮箱或密码错误"

4. 会话持久化

- [ ] 完成登录后，关闭浏览器标签页再重新打开 http://localhost:3000/app → 不需要重新登录（Cookie 7 天有效）

5. 密码重置

- [ ] 访问 /forgot-password，输入已注册邮箱 → 显示"邮件已发送"确认页
- [ ] 输入未注册邮箱 → 同样显示"邮件已发送"（防枚举，不报错）

▎ 要真正收到重置邮件，需要在 backend/.env 里填写真实的 SMTP 配置。开发时可以跳过这一步，直接在后端日志里找 token，手动访问 /reset-password?token=xxx 验证。

- [ ] 访问 /reset-password?token=随便输的→ 显示"重置链接无效或已过期"错误
- [ ] 访问 /reset-password（不带 token）→ 显示"无效的重置链接"提示

6. 后端接口直接验证（可选）

# 注册
curl -s -c /tmp/cookie.txt -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | python3 -m json.tool

# 查看当前用户（带 Cookie）
curl -s -b /tmp/cookie.txt http://localhost:8000/auth/me | python3 -m json.tool

# 登出
curl -s -b /tmp/cookie.txt -c /tmp/cookie.txt -X POST http://localhost:8000/auth/logout

# 登出后再查（应返回 401）
curl -s -b /tmp/cookie.txt http://localhost:8000/auth/me

---
已知待处理事项（合并到 main 前无需解决）

┌────────────┬─────────────────────────────────────────┐
│   优先级   │                  事项                   │
├────────────┼─────────────────────────────────────────┤
│ 生产部署前 │ COOKIE_SECURE=true（HTTPS 环境设置）    │
├────────────┼─────────────────────────────────────────┤
│ 后续       │ 登录/注册接口添加速率限制（防暴力破解） │
├────────────┼─────────────────────────────────────────┤
│ 后续       │ 补充密码重置 token 重放攻击的测试用例   │
└────────────┴─────────────────────────────────────────┘

# 测试环境验证方法

  Thought for 22s

可以验证，但支付需要 Mock 模式（还没有真实支付宝凭证）。

启动两个终端：

终端 1 — 后端：
cd /Users/tongqianwen/ExpProjects/learn/good-sit/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

终端 2 — 前端：
cd /Users/tongqianwen/ExpProjects/learn/good-sit/frontend
npm run dev

▎ ⚠️ 注意：前端不加 NEXT_PUBLIC_USE_MOCK=true，这样才能真实调后端 API（注册、登录、配额、历史都走真实接口）。支付部分在后端 Mock 模式下（没设 ALIPAY_APP_ID）会自动返回 mock-alipay-qr://... 字符串作为二维码内容。

---
验收流程：

┌──────┬───────────┬───────────────────────────────────────────┐
│ 步骤 │   访问    │                 预期结果                  │
├──────┼───────────┼───────────────────────────────────────────┤
│ 1    │ /signup   │ 注册邮箱+密码，跳转 /app                  │
├──────┼───────────┼───────────────────────────────────────────┤
│ 2    │ /app      │ 显示 5 分钟免费试用；开始检测，摄像头启动 │
├──────┼───────────┼───────────────────────────────────────────┤
│ 3    │ 检测页    │ 弓腰 3s 文字警告、5s 语音警告             │
├──────┼───────────┼───────────────────────────────────────────┤
│ 4    │ 停止检测  │ 弹出本次统计报表                          │
├──────┼───────────┼───────────────────────────────────────────┤
│ 5    │ /history  │ 显示刚才的会话记录卡片                    │
├──────┼───────────┼───────────────────────────────────────────┤
│ 6    │ /pricing  │ 点「立即购买」→ 弹出二维码弹窗（Mock QR） │
├──────┼───────────┼───────────────────────────────────────────┤
│ 7    │ 刷新 /app │ 配额仍然显示（Cookie 持久化）             │
└──────┴───────────┴───────────────────────────────────────────┘

---
已知限制（Mock 环境）：
- 支付二维码内容是 mock-alipay-qr://...，无法真正扫码付款
- 弹窗会一直显示「等待支付…」（没有真实回调触发充值）
- 手动测试充值：可以直接调后端 API 注入配额

## 手动给自己充值（测试用）
curl -s -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"你的邮箱","password":"你的密码"}'

## 然后直接向数据库写入配额（sqlite3 命令）
sqlite3 backend/posture.db \
  "INSERT INTO quota_packages (user_id, remaining_seconds, expires_at, created_at)
   VALUES (1, 3600, datetime('now', '+7 days'), datetime('now'));"
