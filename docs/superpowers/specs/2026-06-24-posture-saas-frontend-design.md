# 坐姿检测 SaaS — 前端子系统设计

**日期**：2026-06-24  
**范围**：前端子系统（子系统 1/5）  
**状态**：待实现

---

## 背景

将现有本地 Python 坐姿检测脚本（`check_posture.py`）升级为浏览器可用的 SaaS 服务。本文档覆盖第一个子系统：前端检测页面及相关页面的设计。

后续子系统（用户认证、用量统计、历史报表、支付套餐）将独立设计。

---

## 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | Next.js 15（App Router） | SSR/SSG 支持 SEO，文件系统路由，基于 React |
| 样式 | Tailwind CSS | 响应式布局，快速开发 |
| AI 推理 | `@mediapipe/tasks-vision`（浏览器 WASM） | 视频流不上传，保护用户隐私，无服务器计算成本 |
| 后端 | Python FastAPI（独立服务） | 与现有代码同语言，自动生成 Swagger 文档 |
| 数据库 | PostgreSQL（后续子系统设计） | — |

---

## 页面路由

| 路由 | 渲染方式 | 登录要求 | SEO | 说明 |
|---|---|---|---|---|
| `/` | SSG | 否 | ✅ | 产品落地页 |
| `/pricing` | SSG | 否 | ✅ | 定价与套餐说明 |
| `/login` | CSR | 否 | — | 登录页 |
| `/signup` | CSR | 否 | — | 注册页 |
| `/app` | CSR | ✅ | — | 坐姿检测主页 |
| `/history` | CSR | ✅ | — | 历史会话记录 |

---

## 部署架构

```
用户浏览器
  ├─ Next.js 前端（Vercel 或独立服务器）
  │    ├─ 落地页 / 定价页  ── SSG 静态生成，CDN 分发
  │    └─ /app / /history ── 登录后 CSR 渲染
  │
  └─ HTTP API ──→ FastAPI 后端
                   └─ PostgreSQL
```

---

## /app 检测页 UI 布局

### 桌面端（左右分栏）

```
┌─────────────────────────────────────────────────────┐
│  剩余用量：45 分钟                        [停止检测] │  ← QuotaBanner + SessionControls
├───────────────────────┬─────────────────────────────┤
│                       │        优秀坐姿              │
│   摄像头画面           │      ╭──────╮               │
│   （含骨架叠加）       │    ╭─╯  绿  ╰─╮             │  ← PostureDonut
│                       │    │   橙  绿  │             │
│                       │    ╰─╮       ╭─╯             │
│                       │      ╰──────╯                │
│                       │               不良坐姿        │
│                       │  ─────────────────────────   │
│                       │  时间轴                       │
│                       │  [绿──][橙][绿────][橙]       │  ← PostureTimeline
└───────────────────────┴─────────────────────────────┘
│  ⚠ 请注意坐姿（连续弓腰 3 秒时浮出）                 │  ← AlertBanner
└─────────────────────────────────────────────────────┘
```

### 手机端（上下分栏）

摄像头区域在上，环形图 + 时间轴在下，按钮固定在底部。

---

## 组件结构

```
<DetectionPage>
  ├─ <QuotaBanner>          顶部剩余用量提示，不足时显示购买入口
  ├─ 主内容区
  │    ├─ <CameraView>      摄像头 video + 骨架 canvas 叠加层
  │    └─ 右侧面板
  │         ├─ <PostureDonut>     环形占比图（CSS conic-gradient）
  │         └─ <PostureTimeline>  时间轴色块条
  ├─ <AlertBanner>          弓腰警告浮层（连续 3s 触发）
  ├─ <SessionControls>      开始 / 停止按钮
  └─ <SessionReport>        停止后弹出本次统计报表（Modal）
```

---

## 组件数据接口

### PostureDonut

```ts
type PostureDonutProps = {
  goodSeconds: number
  badSeconds: number
}
// 用 CSS conic-gradient 绘制，无需图表库
// 占比 = goodSeconds / (goodSeconds + badSeconds)
```

### PostureTimeline

```ts
type Segment = {
  type: 'good' | 'bad'
  durationSeconds: number  // 决定色块相对宽度
}
type PostureTimelineProps = {
  segments: Segment[]
}
```

---

## MediaPipe 加载流程

```
用户进入 /app
  ├─ 1. 请求摄像头权限（getUserMedia，优先 facingMode: 'user'）
  ├─ 2. 下载 pose_landmarker_lite.task（约 10MB，托管在 Next.js /public/models/ 目录，首次下载后浏览器缓存）
  ├─ 3. 初始化 PoseLandmarker WASM（约 2-3 秒）
  └─ 4. 显示「开始检测」按钮
          │  用户点击开始
          └─ 5. 启动 requestAnimationFrame 推理循环
                  每帧：video → MediaPipe → 33 关键点 → 坐姿分析
```

加载期间显示进度状态提示，加载完成前「开始」按钮保持禁用。

---

## 坐姿判断算法

沿用 `check_posture.py` 现有逻辑：

```
头肩距离 = 肩膀中点.y - 鼻子.y（MediaPipe 归一化坐标，y 轴向下为正）

弓腰条件（满足任一）：
  - 头肩距离 < 0.18
  - 鼻子.y > 肩膀中点.y（严重趴伏）
```

阈值 `0.18` 在前端作为常量定义（`HUNCH_THRESHOLD = 0.18`），与 `check_posture.py` 保持一致。后续如需动态调整，可通过 `GET /config` 接口下发。

---

## 警告逻辑状态机

```
[正常状态]
    │
    │ 连续弓腰 > 3 秒
    ▼
[文字警告]  → 显示 AlertBanner："请注意坐姿"
    │
    │ 继续弓腰达到 5 秒
    ▼
[语音警告]  → 播放预录音频文件
    │         之后每 30 秒重复播放（直到坐正）
    │
    └─ 任意时刻坐姿恢复正常 ──→ [正常状态]
                                  重置计时器
                                  隐藏 AlertBanner
                                  停止语音循环
```

音频文件：`/public/audio/posture-alert.mp3`，内容为「请注意坐姿」。

---

## 前端调用的后端接口

| 时机 | 方法 | 路径 | 用途 |
|---|---|---|---|
| 进入 /app | GET | `/quota` | 获取剩余用量；返回值为 0 时跳转至 `/pricing` |
| 点击开始 | POST | `/sessions` | 创建会话记录，返回 `sessionId` |
| 检测中每 30s | PATCH | `/sessions/{id}` | 上报累计好/坏坐姿秒数，扣减配额 |
| 点击停止 | PATCH | `/sessions/{id}/end` | 结束会话，返回完整统计数据 |

> 每 30 秒上报一次，防止用户直接关浏览器导致数据丢失。配额在每次上报时同步扣减。

---

## 会话报表（SessionReport Modal）

用户点击停止后弹出，展示：

- 本次检测总时长
- 优秀坐姿时长 + 占比
- 不良坐姿时长 + 占比
- 时间轴回顾（同 PostureTimeline）
- 「查看历史记录」入口

---

## 响应式适配

| 场景 | 布局 | 摄像头 |
|---|---|---|
| 桌面（≥ 768px） | 左右分栏，摄像头占左半 | 前置，`facingMode: 'user'` |
| 手机（< 768px） | 上下分栏，摄像头在上 | 前置，`facingMode: 'user'` |

---

## 未覆盖范围（后续子系统）

- 用户注册 / 登录 / Session 管理（子系统 2）
- 免费试用 5 分钟配额逻辑（子系统 3）
- 历史会话列表与详情页（子系统 4）
- 套餐购买与支付流程（子系统 5）
