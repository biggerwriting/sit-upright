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
