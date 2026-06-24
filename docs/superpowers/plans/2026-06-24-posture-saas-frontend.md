# 坐姿检测 SaaS 前端子系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `frontend/` 目录创建 Next.js 15 前端，实现浏览器内 MediaPipe 坐姿检测、实时可视化反馈、警告逻辑，并与 FastAPI 后端对接。

**Architecture:** Next.js 15 App Router，落地页/定价页 SSG，检测页 CSR。MediaPipe WASM 在浏览器本地推理，视频流不上传。业务逻辑拆分为 4 个 React hook（分析、追踪、警告、推理），组件只负责渲染。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@mediapipe/tasks-vision`, Jest, React Testing Library

## Global Constraints

- Next.js 版本：15（App Router）
- Node.js 版本：≥ 18
- TypeScript strict 模式开启
- Tailwind CSS 作为唯一样式方案，禁止内联 style（canvas 绘制除外）
- 坐姿判断阈值：`HUNCH_THRESHOLD = 0.18`（与 `check_posture.py` 保持一致）
- 文字警告触发：连续弓腰 ≥ 3 秒
- 语音警告触发：连续弓腰 ≥ 5 秒，之后每 30 秒重复
- 模型文件路径：`/models/pose_landmarker_lite.task`（托管在 `public/models/`）
- 语音文件路径：`/audio/posture-alert.mp3`（托管在 `public/audio/`）
- 后端 base URL 从环境变量 `NEXT_PUBLIC_API_URL` 读取，默认 `http://localhost:8000`
- 移动端断点：< 768px 切换为上下分栏布局

---

## 文件结构

```
frontend/                                   ← Next.js 项目根目录
├── public/
│   ├── models/
│   │   └── pose_landmarker_lite.task      ← 从项目根目录复制
│   └── audio/
│       └── posture-alert.mp3             ← 准备一段"请注意坐姿"录音
├── src/
│   ├── app/
│   │   ├── layout.tsx                    ← 根布局
│   │   ├── page.tsx                      ← / 落地页（SSG）
│   │   ├── pricing/page.tsx              ← /pricing 定价页（SSG）
│   │   ├── login/page.tsx                ← /login stub（CSR）
│   │   ├── signup/page.tsx               ← /signup stub（CSR）
│   │   ├── app/page.tsx                  ← /app 检测主页（CSR）
│   │   └── history/page.tsx              ← /history stub（CSR）
│   ├── components/
│   │   ├── detection/
│   │   │   ├── CameraView.tsx
│   │   │   ├── PostureDonut.tsx
│   │   │   ├── PostureTimeline.tsx
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── SessionControls.tsx
│   │   │   ├── SessionReport.tsx
│   │   │   └── QuotaBanner.tsx
│   │   └── ui/
│   │       └── Modal.tsx
│   ├── hooks/
│   │   ├── usePostureAnalyzer.ts
│   │   ├── useSessionTracker.ts
│   │   ├── useAlertManager.ts
│   │   └── useMediaPipe.ts
│   ├── lib/
│   │   ├── constants.ts
│   │   └── api.ts
│   └── types/
│       └── index.ts
└── src/__tests__/
    ├── hooks/
    │   ├── usePostureAnalyzer.test.ts
    │   ├── useSessionTracker.test.ts
    │   └── useAlertManager.test.ts
    └── components/
        ├── PostureDonut.test.tsx
        ├── PostureTimeline.test.tsx
        ├── AlertBanner.test.tsx
        ├── QuotaBanner.test.tsx
        └── SessionReport.test.tsx
```

---

## Task 1: 项目脚手架与测试环境

**Files:**
- Create: `frontend/` （Next.js 项目）
- Create: `frontend/jest.config.ts`
- Create: `frontend/jest.setup.ts`
- Create: `frontend/src/types/index.ts`

**Interfaces:**
- Produces: 可运行的 `npm test`、`npm run dev`

- [ ] **Step 1: 创建 Next.js 项目**

```bash
cd /Users/tongqianwen/ExpProjects/learn/good-sit
npx create-next-app@15 frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack \
  --yes
cd frontend
```

- [ ] **Step 2: 安装依赖**

```bash
npm install @mediapipe/tasks-vision
npm install --save-dev \
  jest \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @types/jest \
  ts-jest
```

- [ ] **Step 3: 写 jest.config.ts**

```typescript
// frontend/jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 4: 写 jest.setup.ts**

```typescript
// frontend/jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: 复制模型和音频文件**

```bash
# 从项目根目录复制模型文件
mkdir -p public/models public/audio
cp ../pose_landmarker_lite.task public/models/
# 音频文件占位（正式录音后替换）
echo "placeholder" > public/audio/posture-alert.mp3
```

- [ ] **Step 6: 验证测试环境可用**

```bash
# package.json 里 scripts 中已有 test，确认可运行
npm test -- --passWithNoTests
```

Expected: `Test Suites: 0 skipped, 0 total`，无报错

- [ ] **Step 7: 提交**

```bash
git add frontend/
git commit -m "新增：Next.js 15 前端项目脚手架"
```

---

## Task 2: 类型定义、常量与 API 客户端

**Files:**
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/constants.ts`
- Create: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces:
  - `Landmark`, `PostureResult`, `Segment`, `SessionStats`, `QuotaInfo` 类型
  - `HUNCH_THRESHOLD`, `ALERT_TEXT_SECONDS`, `ALERT_VOICE_SECONDS`, `ALERT_REPEAT_SECONDS` 常量
  - `api.getQuota()`, `api.createSession()`, `api.updateSession()`, `api.endSession()` 函数

- [ ] **Step 1: 写类型定义**

```typescript
// frontend/src/types/index.ts

export type Landmark = {
  x: number  // 归一化 0-1
  y: number  // 归一化 0-1，向下为正
  z: number
}

export type PostureResult = {
  isHunching: boolean
  headShoulderDist: number  // 头肩距离，正值表示头在肩上方
}

export type Segment = {
  type: 'good' | 'bad'
  durationSeconds: number  // 该段持续秒数
}

export type SessionStats = {
  totalSeconds: number
  goodSeconds: number
  badSeconds: number
  segments: Segment[]
}

export type QuotaInfo = {
  remainingSeconds: number  // 剩余配额（秒）
}

export type SessionId = string
```

- [ ] **Step 2: 写常量**

```typescript
// frontend/src/lib/constants.ts

/** 头肩距离阈值，低于此值判定弓腰（与 check_posture.py 保持一致） */
export const HUNCH_THRESHOLD = 0.18

/** 连续弓腰超过此秒数显示文字警告 */
export const ALERT_TEXT_SECONDS = 3

/** 连续弓腰超过此秒数播放语音警告 */
export const ALERT_VOICE_SECONDS = 5

/** 语音警告后每隔此秒数重复播放（直到坐正） */
export const ALERT_REPEAT_SECONDS = 30

/** 向后端上报的间隔（秒） */
export const REPORT_INTERVAL_SECONDS = 30
```

- [ ] **Step 3: 写 API 客户端**

```typescript
// frontend/src/lib/api.ts
import type { QuotaInfo, SessionId, SessionStats } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Mock 数据（后端未就绪时使用）──────────────────────────────
const MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  getQuota(): Promise<QuotaInfo> {
    if (MOCK) return Promise.resolve({ remainingSeconds: 300 }) // 5 分钟试用
    return request<QuotaInfo>('/quota')
  },

  createSession(): Promise<{ sessionId: SessionId }> {
    if (MOCK) return Promise.resolve({ sessionId: 'mock-session-1' })
    return request<{ sessionId: SessionId }>('/sessions', { method: 'POST' })
  },

  updateSession(
    sessionId: SessionId,
    stats: Pick<SessionStats, 'goodSeconds' | 'badSeconds'>
  ): Promise<void> {
    if (MOCK) return Promise.resolve()
    return request<void>(`/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(stats),
    })
  },

  endSession(sessionId: SessionId): Promise<SessionStats> {
    if (MOCK)
      return Promise.resolve({
        totalSeconds: 60,
        goodSeconds: 45,
        badSeconds: 15,
        segments: [
          { type: 'good', durationSeconds: 30 },
          { type: 'bad', durationSeconds: 10 },
          { type: 'good', durationSeconds: 15 },
          { type: 'bad', durationSeconds: 5 },
        ],
      })
    return request<SessionStats>(`/sessions/${sessionId}/end`, { method: 'PATCH' })
  },
}
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/types/ frontend/src/lib/
git commit -m "新增：类型定义、常量与 API 客户端（含 mock）"
```

---

## Task 3: usePostureAnalyzer hook（TDD）

**Files:**
- Create: `frontend/src/hooks/usePostureAnalyzer.ts`
- Create: `frontend/src/__tests__/hooks/usePostureAnalyzer.test.ts`

**Interfaces:**
- Consumes: `Landmark[]`（33 个关键点），`HUNCH_THRESHOLD`
- Produces: `analyzePosture(landmarks: Landmark[]): PostureResult`

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/hooks/usePostureAnalyzer.test.ts
import { analyzePosture } from '@/hooks/usePostureAnalyzer'
import type { Landmark } from '@/types'

/** 构造一个最简 Landmark 数组（33 个点，默认 0,0,0） */
function makeLandmarks(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0, y: 0, z: 0,
    ...overrides[i],
  }))
}

describe('analyzePosture', () => {
  it('头在肩膀上方足够距离时，判定坐姿良好', () => {
    // 鼻子(0) y=0.3，肩膀(11,12) y=0.6 → dist=0.3 > 0.18
    const landmarks = makeLandmarks({
      0:  { y: 0.3 },
      11: { y: 0.6 },
      12: { y: 0.6 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(false)
    expect(result.headShoulderDist).toBeCloseTo(0.3)
  })

  it('头肩距离小于阈值时，判定弓腰', () => {
    // 鼻子(0) y=0.5，肩膀(11,12) y=0.6 → dist=0.1 < 0.18
    const landmarks = makeLandmarks({
      0:  { y: 0.5 },
      11: { y: 0.6 },
      12: { y: 0.6 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(true)
  })

  it('鼻子低于肩膀时，判定严重趴伏', () => {
    // 鼻子(0) y=0.7，肩膀 y=0.5 → 鼻子低于肩膀
    const landmarks = makeLandmarks({
      0:  { y: 0.7 },
      11: { y: 0.5 },
      12: { y: 0.5 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(true)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- usePostureAnalyzer --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/hooks/usePostureAnalyzer'`

- [ ] **Step 3: 实现 analyzePosture**

```typescript
// frontend/src/hooks/usePostureAnalyzer.ts
import { HUNCH_THRESHOLD } from '@/lib/constants'
import type { Landmark, PostureResult } from '@/types'

// MediaPipe 33点关键点索引
const IDX_NOSE       = 0
const IDX_L_SHOULDER = 11
const IDX_R_SHOULDER = 12

export function analyzePosture(landmarks: Landmark[]): PostureResult {
  const nose    = landmarks[IDX_NOSE]
  const lSh     = landmarks[IDX_L_SHOULDER]
  const rSh     = landmarks[IDX_R_SHOULDER]
  const shMidY  = (lSh.y + rSh.y) / 2

  // y 轴向下为正；头在肩上方时 dist > 0
  const headShoulderDist = shMidY - nose.y
  const noseBelowShoulder = nose.y > shMidY

  const isHunching = headShoulderDist < HUNCH_THRESHOLD || noseBelowShoulder

  return { isHunching, headShoulderDist }
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- usePostureAnalyzer --no-coverage
```

Expected: `PASS` — 3 tests passed

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/usePostureAnalyzer.ts \
        frontend/src/__tests__/hooks/usePostureAnalyzer.test.ts
git commit -m "新增：usePostureAnalyzer — 坐姿判断算法（TDD）"
```

---

## Task 4: useSessionTracker hook（TDD）

**Files:**
- Create: `frontend/src/hooks/useSessionTracker.ts`
- Create: `frontend/src/__tests__/hooks/useSessionTracker.test.ts`

**Interfaces:**
- Consumes: `isHunching: boolean`（每秒调用一次 `tick`）
- Produces:
  - `tick(isHunching: boolean): void`
  - `stats: SessionStats`
  - `reset(): void`

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/hooks/useSessionTracker.test.ts
import { renderHook, act } from '@testing-library/react'
import { useSessionTracker } from '@/hooks/useSessionTracker'

describe('useSessionTracker', () => {
  it('初始状态全为 0', () => {
    const { result } = renderHook(() => useSessionTracker())
    expect(result.current.stats).toEqual({
      totalSeconds: 0,
      goodSeconds: 0,
      badSeconds: 0,
      segments: [],
    })
  })

  it('tick(false) 累加 goodSeconds', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) })
    act(() => { result.current.tick(false) })
    expect(result.current.stats.goodSeconds).toBe(2)
    expect(result.current.stats.totalSeconds).toBe(2)
  })

  it('tick(true) 累加 badSeconds', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(true) })
    expect(result.current.stats.badSeconds).toBe(1)
    expect(result.current.stats.totalSeconds).toBe(1)
  })

  it('状态切换时追加 segment', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) }) // good 1s
    act(() => { result.current.tick(false) }) // good 2s
    act(() => { result.current.tick(true)  }) // bad 1s → 切换
    const { segments } = result.current.stats
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ type: 'good', durationSeconds: 2 })
    expect(segments[1]).toEqual({ type: 'bad',  durationSeconds: 1 })
  })

  it('reset 清空所有状态', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) })
    act(() => { result.current.reset() })
    expect(result.current.stats.totalSeconds).toBe(0)
    expect(result.current.stats.segments).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- useSessionTracker --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/hooks/useSessionTracker'`

- [ ] **Step 3: 实现 useSessionTracker**

```typescript
// frontend/src/hooks/useSessionTracker.ts
import { useState, useCallback } from 'react'
import type { Segment, SessionStats } from '@/types'

const EMPTY_STATS: SessionStats = {
  totalSeconds: 0,
  goodSeconds: 0,
  badSeconds: 0,
  segments: [],
}

export function useSessionTracker() {
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  // 当前段的类型（null 表示尚未开始）
  const [currentSegType, setCurrentSegType] = useState<'good' | 'bad' | null>(null)
  const [currentSegDuration, setCurrentSegDuration] = useState(0)

  const tick = useCallback((isHunching: boolean) => {
    const type: 'good' | 'bad' = isHunching ? 'bad' : 'good'

    setStats(prev => {
      const newTotal = prev.totalSeconds + 1
      const newGood  = prev.goodSeconds + (isHunching ? 0 : 1)
      const newBad   = prev.badSeconds  + (isHunching ? 1 : 0)

      // 当前段和上一段相同：只延长
      if (type === currentSegType) {
        const newDur = currentSegDuration + 1
        setCurrentSegDuration(newDur)
        const updatedSegs = [...prev.segments]
        updatedSegs[updatedSegs.length - 1] = { type, durationSeconds: newDur }
        return { totalSeconds: newTotal, goodSeconds: newGood, badSeconds: newBad, segments: updatedSegs }
      }

      // 状态切换：追加新段
      setCurrentSegType(type)
      setCurrentSegDuration(1)
      return {
        totalSeconds: newTotal,
        goodSeconds: newGood,
        badSeconds: newBad,
        segments: [...prev.segments, { type, durationSeconds: 1 }],
      }
    })
  }, [currentSegType, currentSegDuration])

  const reset = useCallback(() => {
    setStats(EMPTY_STATS)
    setCurrentSegType(null)
    setCurrentSegDuration(0)
  }, [])

  return { stats, tick, reset }
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- useSessionTracker --no-coverage
```

Expected: `PASS` — 5 tests passed

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/useSessionTracker.ts \
        frontend/src/__tests__/hooks/useSessionTracker.test.ts
git commit -m "新增：useSessionTracker — 会话计时与分段追踪（TDD）"
```

---

## Task 5: useAlertManager hook（TDD）

**Files:**
- Create: `frontend/src/hooks/useAlertManager.ts`
- Create: `frontend/src/__tests__/hooks/useAlertManager.test.ts`

**Interfaces:**
- Consumes: `isHunching: boolean`（每秒调用 `update`）
- Produces:
  - `update(isHunching: boolean): void`
  - `showTextAlert: boolean`
  - `reset(): void`

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/hooks/useAlertManager.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAlertManager } from '@/hooks/useAlertManager'

// 静音 audio.play（jsdom 不支持音频）
beforeEach(() => {
  window.HTMLMediaElement.prototype.play  = jest.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = jest.fn()
  window.HTMLMediaElement.prototype.load  = jest.fn()
})

describe('useAlertManager', () => {
  it('初始状态不显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    expect(result.current.showTextAlert).toBe(false)
  })

  it('弓腰不足 3 秒时不显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(false)
  })

  it('连续弓腰 3 秒后显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(true)
  })

  it('坐正后隐藏文字警告并重置计时', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(true)
    act(() => { result.current.update(false) })
    expect(result.current.showTextAlert).toBe(false)
  })

  it('reset 后隐藏所有警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.reset() })
    expect(result.current.showTextAlert).toBe(false)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- useAlertManager --no-coverage
```

Expected: `FAIL` — `Cannot find module '@/hooks/useAlertManager'`

- [ ] **Step 3: 实现 useAlertManager**

```typescript
// frontend/src/hooks/useAlertManager.ts
import { useState, useCallback, useRef } from 'react'
import { ALERT_TEXT_SECONDS, ALERT_VOICE_SECONDS, ALERT_REPEAT_SECONDS } from '@/lib/constants'

export function useAlertManager() {
  const [showTextAlert, setShowTextAlert] = useState(false)
  const hunchSecsRef      = useRef(0)
  const lastVoiceAtRef    = useRef<number | null>(null) // 最后一次语音警告时的累计弓腰秒数

  const playAudio = useCallback(() => {
    const audio = new Audio('/audio/posture-alert.mp3')
    audio.play().catch(() => {
      // 浏览器自动播放策略可能拒绝，静默处理
    })
  }, [])

  const update = useCallback((isHunching: boolean) => {
    if (!isHunching) {
      // 坐正 → 全部重置
      hunchSecsRef.current  = 0
      lastVoiceAtRef.current = null
      setShowTextAlert(false)
      return
    }

    hunchSecsRef.current += 1
    const secs = hunchSecsRef.current

    // 文字警告
    if (secs >= ALERT_TEXT_SECONDS) {
      setShowTextAlert(true)
    }

    // 语音警告：首次触发（5s），之后每 30s 重复
    if (secs >= ALERT_VOICE_SECONDS) {
      const lastAt = lastVoiceAtRef.current
      if (lastAt === null || secs - lastAt >= ALERT_REPEAT_SECONDS) {
        playAudio()
        lastVoiceAtRef.current = secs
      }
    }
  }, [playAudio])

  const reset = useCallback(() => {
    hunchSecsRef.current   = 0
    lastVoiceAtRef.current = null
    setShowTextAlert(false)
  }, [])

  return { showTextAlert, update, reset }
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- useAlertManager --no-coverage
```

Expected: `PASS` — 5 tests passed

- [ ] **Step 5: 提交**

```bash
git add frontend/src/hooks/useAlertManager.ts \
        frontend/src/__tests__/hooks/useAlertManager.test.ts
git commit -m "新增：useAlertManager — 文字/语音警告状态机（TDD）"
```

---

## Task 6: useMediaPipe hook

**Files:**
- Create: `frontend/src/hooks/useMediaPipe.ts`

**Interfaces:**
- Consumes: `videoRef: RefObject<HTMLVideoElement>`, `canvasRef: RefObject<HTMLCanvasElement>`, `onPostureResult: (result: PostureResult) => void`
- Produces:
  - `status: 'idle' | 'loading' | 'ready' | 'error'`
  - `startDetection(): void`
  - `stopDetection(): void`

> ⚠️ 此 hook 深度依赖浏览器 API（getUserMedia、requestAnimationFrame、WASM），不做 unit test；在 Task 14 集成后通过浏览器手动验证。

- [ ] **Step 1: 实现 useMediaPipe**

```typescript
// frontend/src/hooks/useMediaPipe.ts
'use client'
import { useState, useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { PostureResult } from '@/types'
import { analyzePosture } from './usePostureAnalyzer'

// MediaPipe 骨架连接线（与 check_posture.py 一致）
const CONNECTIONS: [number, number][] = [
  [0, 11], [0, 12], [11, 12],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
]
const KEY_IDXS = [0, 11, 12, 23, 24, 25, 26, 27, 28]

export type MediaPipeStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useMediaPipe(
  videoRef: RefObject<HTMLVideoElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  onPostureResult: (result: PostureResult) => void
) {
  const [status, setStatus] = useState<MediaPipeStatus>('idle')
  const rafRef      = useRef<number | null>(null)
  const landmarkerRef = useRef<InstanceType<typeof import('@mediapipe/tasks-vision').PoseLandmarker> | null>(null)
  const startTimeRef  = useRef<number>(0)

  const initialize = useCallback(async () => {
    setStatus('loading')
    try {
      const { PoseLandmarker, FilesetResolver, DrawingUtils } =
        await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      )
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  const startDetection = useCallback(async () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !landmarkerRef.current) return

    // 请求摄像头（优先前置）
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
    })
    video.srcObject = stream
    await video.play()

    startTimeRef.current = performance.now()
    const ctx = canvas.getContext('2d')!

    const loop = () => {
      if (!landmarkerRef.current) return
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const tsMs = performance.now() - startTimeRef.current

      const result = landmarkerRef.current.detectForVideo(video, tsMs)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (result.landmarks.length > 0) {
        const lms = result.landmarks[0]
        const w = canvas.width, h = canvas.height

        // 画连接线
        ctx.strokeStyle = 'rgba(100,200,100,0.9)'
        ctx.lineWidth   = 2
        for (const [i, j] of CONNECTIONS) {
          ctx.beginPath()
          ctx.moveTo(lms[i].x * w, lms[i].y * h)
          ctx.lineTo(lms[j].x * w, lms[j].y * h)
          ctx.stroke()
        }
        // 画关键点
        ctx.fillStyle = 'rgb(50,150,255)'
        for (const idx of KEY_IDXS) {
          ctx.beginPath()
          ctx.arc(lms[idx].x * w, lms[idx].y * h, 5, 0, Math.PI * 2)
          ctx.fill()
        }

        onPostureResult(analyzePosture(lms))
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoRef, canvasRef, onPostureResult])

  const stopDetection = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
  }, [videoRef])

  return { status, initialize, startDetection, stopDetection }
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/hooks/useMediaPipe.ts
git commit -m "新增：useMediaPipe — WASM 推理循环与骨架绘制"
```

---

## Task 7: PostureDonut 组件（TDD）

**Files:**
- Create: `frontend/src/components/detection/PostureDonut.tsx`
- Create: `frontend/src/__tests__/components/PostureDonut.test.tsx`

**Interfaces:**
- Consumes: `PostureDonutProps = { goodSeconds: number, badSeconds: number }`
- Produces: 渲染环形图，green/orange 两段

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/components/PostureDonut.test.tsx
import { render, screen } from '@testing-library/react'
import { PostureDonut } from '@/components/detection/PostureDonut'

describe('PostureDonut', () => {
  it('显示优秀坐姿和不良坐姿标签', () => {
    render(<PostureDonut goodSeconds={40} badSeconds={20} />)
    expect(screen.getByText('优秀坐姿')).toBeInTheDocument()
    expect(screen.getByText('不良坐姿')).toBeInTheDocument()
  })

  it('全为 0 时显示 0% 不良', () => {
    render(<PostureDonut goodSeconds={0} badSeconds={0} />)
    expect(screen.getByTestId('bad-pct').textContent).toBe('0%')
  })

  it('badSeconds=20 goodSeconds=60 时显示 25% 不良', () => {
    render(<PostureDonut goodSeconds={60} badSeconds={20} />)
    expect(screen.getByTestId('bad-pct').textContent).toBe('25%')
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- PostureDonut --no-coverage
```

Expected: `FAIL`

- [ ] **Step 3: 实现 PostureDonut**

```tsx
// frontend/src/components/detection/PostureDonut.tsx
'use client'
import type { PostureDonutProps } from './types'

export type { PostureDonutProps }

export function PostureDonut({ goodSeconds, badSeconds }: PostureDonutProps) {
  const total   = goodSeconds + badSeconds
  const badPct  = total === 0 ? 0 : Math.round((badSeconds  / total) * 100)
  const goodPct = 100 - badPct

  // conic-gradient: 从 12 点钟方向顺时针，绿→橙
  const gradient = `conic-gradient(
    #22c55e 0% ${goodPct}%,
    #f97316 ${goodPct}% 100%
  )`

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* 外圈 */}
        <div
          className="w-40 h-40 rounded-full"
          style={{ background: gradient }}
        />
        {/* 内圈挖空 */}
        <div className="absolute w-24 h-24 rounded-full bg-white dark:bg-gray-900" />
      </div>

      <div className="flex gap-6 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          优秀坐姿
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
          不良坐姿
          <span data-testid="bad-pct" className="font-bold text-orange-400">
            {badPct}%
          </span>
        </span>
      </div>
    </div>
  )
}
```

同时在 `components/detection/` 下新建 `types.ts`（避免循环导入）：

```typescript
// frontend/src/components/detection/types.ts
import type { Segment } from '@/types'

export type PostureDonutProps = {
  goodSeconds: number
  badSeconds:  number
}

export type PostureTimelineProps = {
  segments: Segment[]
}

export type AlertBannerProps = {
  show: boolean
}

export type QuotaBannerProps = {
  remainingSeconds: number
}

export type SessionControlsProps = {
  status: 'idle' | 'loading' | 'running'
  onStart: () => void
  onStop:  () => void
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- PostureDonut --no-coverage
```

Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/detection/
git commit -m "新增：PostureDonut 环形占比图组件（TDD）"
```

---

## Task 8: PostureTimeline 组件（TDD）

**Files:**
- Create: `frontend/src/components/detection/PostureTimeline.tsx`
- Create: `frontend/src/__tests__/components/PostureTimeline.test.tsx`

**Interfaces:**
- Consumes: `PostureTimelineProps = { segments: Segment[] }`
- Produces: 横向色块条，绿=good，橙=bad，宽度按时长比例

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/components/PostureTimeline.test.tsx
import { render, screen } from '@testing-library/react'
import { PostureTimeline } from '@/components/detection/PostureTimeline'
import type { Segment } from '@/types'

describe('PostureTimeline', () => {
  it('空 segments 时显示占位提示', () => {
    render(<PostureTimeline segments={[]} />)
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
  })

  it('渲染正确数量的色块', () => {
    const segs: Segment[] = [
      { type: 'good', durationSeconds: 30 },
      { type: 'bad',  durationSeconds: 10 },
      { type: 'good', durationSeconds: 20 },
    ]
    render(<PostureTimeline segments={segs} />)
    expect(screen.getAllByTestId('timeline-segment')).toHaveLength(3)
  })

  it('good 段使用绿色，bad 段使用橙色', () => {
    const segs: Segment[] = [
      { type: 'good', durationSeconds: 1 },
      { type: 'bad',  durationSeconds: 1 },
    ]
    const { container } = render(<PostureTimeline segments={segs} />)
    const blocks = container.querySelectorAll('[data-testid="timeline-segment"]')
    expect(blocks[0].classList).toContain('bg-green-400')
    expect(blocks[1].classList).toContain('bg-orange-400')
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- PostureTimeline --no-coverage
```

- [ ] **Step 3: 实现 PostureTimeline**

```tsx
// frontend/src/components/detection/PostureTimeline.tsx
import type { PostureTimelineProps } from './types'

export function PostureTimeline({ segments }: PostureTimelineProps) {
  if (segments.length === 0) {
    return (
      <div data-testid="timeline-empty" className="text-xs text-gray-400 text-center py-2">
        检测开始后显示时间轴
      </div>
    )
  }

  const total = segments.reduce((s, seg) => s + seg.durationSeconds, 0)

  return (
    <div className="w-full">
      <p className="text-xs text-gray-500 mb-1">时间轴</p>
      <div className="flex w-full h-5 rounded overflow-hidden gap-px">
        {segments.map((seg, i) => (
          <div
            key={i}
            data-testid="timeline-segment"
            className={`h-full ${seg.type === 'good' ? 'bg-green-400' : 'bg-orange-400'}`}
            style={{ width: `${(seg.durationSeconds / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npm test -- PostureTimeline --no-coverage
```

Expected: `PASS`

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/detection/PostureTimeline.tsx \
        frontend/src/__tests__/components/PostureTimeline.test.tsx
git commit -m "新增：PostureTimeline 时间轴色块组件（TDD）"
```

---

## Task 9: AlertBanner、QuotaBanner、SessionControls 组件（TDD）

**Files:**
- Create: `frontend/src/components/detection/AlertBanner.tsx`
- Create: `frontend/src/components/detection/QuotaBanner.tsx`
- Create: `frontend/src/components/detection/SessionControls.tsx`
- Create: `frontend/src/__tests__/components/AlertBanner.test.tsx`
- Create: `frontend/src/__tests__/components/QuotaBanner.test.tsx`

- [ ] **Step 1: 写 AlertBanner 测试**

```typescript
// frontend/src/__tests__/components/AlertBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { AlertBanner } from '@/components/detection/AlertBanner'

describe('AlertBanner', () => {
  it('show=false 时不渲染', () => {
    const { container } = render(<AlertBanner show={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('show=true 时显示警告文字', () => {
    render(<AlertBanner show={true} />)
    expect(screen.getByText('⚠ 请注意坐姿')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 实现 AlertBanner**

```tsx
// frontend/src/components/detection/AlertBanner.tsx
import type { AlertBannerProps } from './types'

export function AlertBanner({ show }: AlertBannerProps) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                    bg-red-500 text-white px-6 py-3 rounded-full
                    shadow-lg text-base font-semibold animate-bounce">
      ⚠ 请注意坐姿
    </div>
  )
}
```

- [ ] **Step 3: 写 QuotaBanner 测试**

```typescript
// frontend/src/__tests__/components/QuotaBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { QuotaBanner } from '@/components/detection/QuotaBanner'

describe('QuotaBanner', () => {
  it('显示剩余分钟数', () => {
    render(<QuotaBanner remainingSeconds={300} />)
    expect(screen.getByText(/剩余用量：5 分钟/)).toBeInTheDocument()
  })

  it('配额为 0 时显示购买入口', () => {
    render(<QuotaBanner remainingSeconds={0} />)
    expect(screen.getByText(/购买套餐/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 实现 QuotaBanner**

```tsx
// frontend/src/components/detection/QuotaBanner.tsx
import Link from 'next/link'
import type { QuotaBannerProps } from './types'

export function QuotaBanner({ remainingSeconds }: QuotaBannerProps) {
  const minutes = Math.floor(remainingSeconds / 60)

  if (remainingSeconds === 0) {
    return (
      <div className="w-full bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex justify-between items-center">
        <span>用量已耗尽</span>
        <Link href="/pricing" className="underline font-semibold">购买套餐</Link>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-50 border-b px-4 py-2 text-sm text-gray-600">
      剩余用量：{minutes} 分钟
    </div>
  )
}
```

- [ ] **Step 5: 实现 SessionControls**

```tsx
// frontend/src/components/detection/SessionControls.tsx
import type { SessionControlsProps } from './types'

export function SessionControls({ status, onStart, onStop }: SessionControlsProps) {
  if (status === 'loading') {
    return (
      <button disabled className="px-6 py-2 rounded-full bg-gray-300 text-gray-500 cursor-not-allowed">
        正在加载模型…
      </button>
    )
  }

  if (status === 'running') {
    return (
      <button
        onClick={onStop}
        className="px-6 py-2 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 transition"
      >
        停止检测
      </button>
    )
  }

  return (
    <button
      onClick={onStart}
      className="px-6 py-2 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition"
    >
      开始检测
    </button>
  )
}
```

- [ ] **Step 6: 运行所有组件测试**

```bash
npm test -- AlertBanner QuotaBanner --no-coverage
```

Expected: `PASS` — all tests passed

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/detection/AlertBanner.tsx \
        frontend/src/components/detection/QuotaBanner.tsx \
        frontend/src/components/detection/SessionControls.tsx \
        frontend/src/__tests__/components/AlertBanner.test.tsx \
        frontend/src/__tests__/components/QuotaBanner.test.tsx
git commit -m "新增：AlertBanner、QuotaBanner、SessionControls 组件（TDD）"
```

---

## Task 10: SessionReport Modal

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`
- Create: `frontend/src/components/detection/SessionReport.tsx`
- Create: `frontend/src/__tests__/components/SessionReport.test.tsx`

**Interfaces:**
- Consumes: `{ stats: SessionStats; onClose: () => void }`
- Produces: 会话结束报表弹窗

- [ ] **Step 1: 写失败测试**

```typescript
// frontend/src/__tests__/components/SessionReport.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionReport } from '@/components/detection/SessionReport'
import type { SessionStats } from '@/types'

const stats: SessionStats = {
  totalSeconds: 60,
  goodSeconds: 45,
  badSeconds: 15,
  segments: [
    { type: 'good', durationSeconds: 45 },
    { type: 'bad',  durationSeconds: 15 },
  ],
}

describe('SessionReport', () => {
  it('显示总时长', () => {
    render(<SessionReport stats={stats} onClose={() => {}} />)
    expect(screen.getByText(/本次检测：1 分 0 秒/)).toBeInTheDocument()
  })

  it('显示优秀坐姿时长和占比', () => {
    render(<SessionReport stats={stats} onClose={() => {}} />)
    expect(screen.getByText(/优秀坐姿：45 秒/)).toBeInTheDocument()
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('点击关闭按钮调用 onClose', async () => {
    const onClose = jest.fn()
    render(<SessionReport stats={stats} onClose={onClose} />)
    await userEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```bash
npm test -- SessionReport --no-coverage
```

- [ ] **Step 3: 实现 Modal**

```tsx
// frontend/src/components/ui/Modal.tsx
'use client'
import type { ReactNode } from 'react'

type ModalProps = { children: ReactNode; onClose: () => void }

export function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 实现 SessionReport**

```tsx
// frontend/src/components/detection/SessionReport.tsx
import { Modal } from '@/components/ui/Modal'
import { PostureTimeline } from './PostureTimeline'
import type { SessionStats } from '@/types'

type Props = { stats: SessionStats; onClose: () => void }

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m} 分 ${s} 秒`
}

export function SessionReport({ stats, onClose }: Props) {
  const { totalSeconds, goodSeconds, badSeconds, segments } = stats
  const goodPct = totalSeconds === 0 ? 0 : Math.round((goodSeconds / totalSeconds) * 100)

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold mb-4">本次检测报告</h2>

      <p className="text-gray-600 mb-3">本次检测：{fmtTime(totalSeconds)}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-green-600">优秀坐姿：{goodSeconds} 秒</span>
          <span className="font-semibold text-green-600">{goodPct}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-orange-500">不良坐姿：{badSeconds} 秒</span>
          <span className="font-semibold text-orange-500">{100 - goodPct}%</span>
        </div>
      </div>

      <PostureTimeline segments={segments} />

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border hover:bg-gray-50 transition"
        >
          关闭
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 5: 运行，确认通过**

```bash
npm test -- SessionReport --no-coverage
```

Expected: `PASS`

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/
git commit -m "新增：SessionReport Modal 会话报表组件（TDD）"
```

---

## Task 11: CameraView 组件

**Files:**
- Create: `frontend/src/components/detection/CameraView.tsx`

**Interfaces:**
- Consumes: `videoRef`, `canvasRef`（来自父组件，转发给 DOM 元素）
- Produces: 摄像头画面 + 骨架 canvas 叠加层

> 此组件是纯渲染层，不含逻辑，通过 Task 14 浏览器集成验证。

- [ ] **Step 1: 实现 CameraView**

```tsx
// frontend/src/components/detection/CameraView.tsx
'use client'
import { forwardRef } from 'react'

type CameraViewProps = {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
}

export function CameraView({ videoRef, canvasRef }: CameraViewProps) {
  return (
    <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1]"
      />
    </div>
  )
}
```

> `scale-x-[-1]` 镜像翻转：前置摄像头的视角和用户习惯一致。

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/detection/CameraView.tsx
git commit -m "新增：CameraView 摄像头渲染组件"
```

---

## Task 12: DetectionPage 组装与 API 集成

**Files:**
- Create: `frontend/src/app/app/page.tsx`

**Interfaces:**
- Consumes: 所有 hooks + components from Tasks 3-11
- Produces: 完整的 `/app` 检测页

- [ ] **Step 1: 实现 DetectionPage**

```tsx
// frontend/src/app/app/page.tsx
'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMediaPipe }       from '@/hooks/useMediaPipe'
import { useSessionTracker }  from '@/hooks/useSessionTracker'
import { useAlertManager }    from '@/hooks/useAlertManager'
import { CameraView }         from '@/components/detection/CameraView'
import { PostureDonut }       from '@/components/detection/PostureDonut'
import { PostureTimeline }    from '@/components/detection/PostureTimeline'
import { AlertBanner }        from '@/components/detection/AlertBanner'
import { SessionControls }    from '@/components/detection/SessionControls'
import { SessionReport }      from '@/components/detection/SessionReport'
import { QuotaBanner }        from '@/components/detection/QuotaBanner'
import { api }                from '@/lib/api'
import { REPORT_INTERVAL_SECONDS } from '@/lib/constants'
import type { PostureResult } from '@/types'
import type { SessionStats }  from '@/types'

type PageStatus = 'idle' | 'loading' | 'running'

export default function AppPage() {
  const router    = useRouter()
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [pageStatus, setPageStatus]   = useState<PageStatus>('idle')
  const [quota, setQuota]             = useState<number | null>(null)
  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [finalStats, setFinalStats]   = useState<SessionStats | null>(null)
  const tickTimerRef                  = useRef<ReturnType<typeof setInterval> | null>(null)
  const reportTimerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastResultRef                 = useRef<PostureResult>({ isHunching: false, headShoulderDist: 0 })

  const tracker = useSessionTracker()
  const alerts  = useAlertManager()

  // 每帧推理回调
  const handlePostureResult = useCallback((result: PostureResult) => {
    lastResultRef.current = result
  }, [])

  const mediaPipe = useMediaPipe(videoRef, canvasRef, handlePostureResult)

  // 进入页面：初始化 MediaPipe + 检查配额
  useEffect(() => {
    mediaPipe.initialize()
    api.getQuota().then(q => {
      if (q.remainingSeconds === 0) router.push('/pricing')
      else setQuota(q.remainingSeconds)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = useCallback(async () => {
    setPageStatus('loading')
    const { sessionId: sid } = await api.createSession()
    setSessionId(sid)
    await mediaPipe.startDetection()
    setPageStatus('running')

    // 每秒 tick
    tickTimerRef.current = setInterval(() => {
      const { isHunching } = lastResultRef.current
      tracker.tick(isHunching)
      alerts.update(isHunching)
    }, 1000)

    // 每 30s 上报
    reportTimerRef.current = setInterval(() => {
      api.updateSession(sid, {
        goodSeconds: tracker.stats.goodSeconds,
        badSeconds:  tracker.stats.badSeconds,
      })
    }, REPORT_INTERVAL_SECONDS * 1000)
  }, [mediaPipe, tracker, alerts])

  const stopSession = useCallback(async () => {
    clearInterval(tickTimerRef.current!)
    clearInterval(reportTimerRef.current!)
    mediaPipe.stopDetection()
    alerts.reset()

    const stats = await api.endSession(sessionId!)
    setFinalStats(stats)
    setPageStatus('idle')
    tracker.reset()
  }, [mediaPipe, alerts, tracker, sessionId])

  return (
    <div className="min-h-screen flex flex-col">
      {quota !== null && <QuotaBanner remainingSeconds={quota} />}

      {/* 主内容：桌面左右 / 手机上下 */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4">
        {/* 摄像头 */}
        <div className="md:w-1/2">
          <CameraView videoRef={videoRef} canvasRef={canvasRef} />
        </div>

        {/* 右侧面板 */}
        <div className="md:w-1/2 flex flex-col items-center gap-6 justify-center">
          <PostureDonut
            goodSeconds={tracker.stats.goodSeconds}
            badSeconds={tracker.stats.badSeconds}
          />
          <PostureTimeline segments={tracker.stats.segments} />
        </div>
      </main>

      {/* 控制按钮 */}
      <div className="flex justify-center pb-6">
        <SessionControls
          status={pageStatus}
          onStart={startSession}
          onStop={stopSession}
        />
      </div>

      {/* 警告 */}
      <AlertBanner show={alerts.showTextAlert} />

      {/* 报表 */}
      {finalStats && (
        <SessionReport
          stats={finalStats}
          onClose={() => setFinalStats(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 本地验证（手动）**

```bash
NEXT_PUBLIC_USE_MOCK=true npm run dev
```

打开 `http://localhost:3000/app`，确认：
- 页面加载，顶部显示「剩余用量：5 分钟」
- 点击「开始检测」后摄像头画面出现，骨架线叠加
- 故意弓腰 3 秒后出现红色警告横幅
- 点击「停止检测」后弹出会话报表 Modal
- 报表中显示时长和时间轴

- [ ] **Step 3: 提交**

```bash
git add frontend/src/app/app/
git commit -m "新增：DetectionPage 检测主页组装与 API 集成"
```

---

## Task 13: 静态页面（落地页、定价页、路由 stub）

**Files:**
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/pricing/page.tsx`
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/signup/page.tsx`
- Create: `frontend/src/app/history/page.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 根布局**

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '坐姿检测 — PostureMonitor',
  description: '通过摄像头实时检测坐姿，智能提醒，守护脊椎健康。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: 落地页（SSG）**

```tsx
// frontend/src/app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 text-center">
      <h1 className="text-4xl font-bold">坐姿检测</h1>
      <p className="text-gray-600 max-w-md">
        通过摄像头实时检测坐姿，弓腰时立即提醒。AI 在浏览器本地运行，视频不上传。
      </p>
      <div className="flex gap-4">
        <Link
          href="/app"
          className="px-6 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition"
        >
          免费试用 5 分钟
        </Link>
        <Link
          href="/pricing"
          className="px-6 py-3 rounded-full border hover:bg-gray-50 transition"
        >
          查看定价
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 定价页（SSG）**

```tsx
// frontend/src/app/pricing/page.tsx
import Link from 'next/link'

export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold">套餐选择</h1>

      <div className="border rounded-2xl p-8 max-w-sm w-full text-center shadow">
        <h2 className="text-xl font-semibold mb-2">标准套餐</h2>
        <p className="text-gray-500 mb-4">7 天内 1 小时坐姿检测</p>
        <p className="text-4xl font-bold mb-6">¥9.9</p>
        <Link
          href="/signup"
          className="block px-6 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition"
        >
          立即购买
        </Link>
      </div>

      <p className="text-sm text-gray-400">新用户免费试用 5 分钟，无需注册</p>
    </main>
  )
}
```

- [ ] **Step 4: 其余 stub 页面**

```tsx
// frontend/src/app/login/page.tsx
export default function LoginPage() {
  return <main className="min-h-screen flex items-center justify-center"><p>登录页（待实现）</p></main>
}
```

```tsx
// frontend/src/app/signup/page.tsx
export default function SignupPage() {
  return <main className="min-h-screen flex items-center justify-center"><p>注册页（待实现）</p></main>
}
```

```tsx
// frontend/src/app/history/page.tsx
export default function HistoryPage() {
  return <main className="min-h-screen flex items-center justify-center"><p>历史记录页（待实现）</p></main>
}
```

- [ ] **Step 5: 验证 SSG 构建**

```bash
npm run build
```

Expected: 无报错，`/` 和 `/pricing` 显示为 `○ (Static)`

- [ ] **Step 6: 提交**

```bash
git add frontend/src/app/
git commit -m "新增：落地页（SSG）、定价页（SSG）、路由 stub 页面"
```

---

## Task 14: 全量测试与最终验收

- [ ] **Step 1: 运行所有测试**

```bash
cd frontend && npm test -- --no-coverage
```

Expected: 所有测试 `PASS`，无 skip

- [ ] **Step 2: mock 模式端到端验证**

```bash
NEXT_PUBLIC_USE_MOCK=true npm run dev
```

逐一验证：
- `http://localhost:3000/` — 落地页正常，「免费试用」按钮可点击
- `http://localhost:3000/pricing` — 定价页正常
- `http://localhost:3000/app` — 加载后显示用量横幅，开始检测可用，弓腰 3s 显示警告，停止后显示报表
- 手机模拟器（DevTools → 375px）— 上下分栏布局正常

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "完成：坐姿检测 SaaS 前端子系统（子系统 1/5）"
```
