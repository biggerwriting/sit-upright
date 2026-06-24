// frontend/src/lib/api.ts
import type { QuotaInfo, SessionId, SessionListResponse, SessionStats, User } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',                         // ← 新增：携带 Cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  // ── 认证 ─────────────────────────────────────────────────────
  auth: {
    signup(email: string, password: string): Promise<User> {
      if (MOCK) return Promise.resolve({ id: 1, email })
      return request<User>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
    },

    login(email: string, password: string): Promise<User> {
      if (MOCK) return Promise.resolve({ id: 1, email })
      return request<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
    },

    logout(): Promise<void> {
      if (MOCK) return Promise.resolve()
      return request<void>('/auth/logout', { method: 'POST' })
    },

    me(): Promise<User> {
      if (MOCK) return Promise.resolve({ id: 1, email: 'demo@example.com' })
      return request<User>('/auth/me')
    },

    forgotPassword(email: string): Promise<void> {
      if (MOCK) return Promise.resolve()
      return request<void>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    },

    resetPassword(token: string, newPassword: string): Promise<void> {
      if (MOCK) return Promise.resolve()
      return request<void>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      })
    },
  },

  // ── 会话（子系统 1 原有）────────────────────────────────────
  getQuota(): Promise<QuotaInfo> {
    if (MOCK) return Promise.resolve({ remainingSeconds: 300, nearExpiry: null })
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

  // ── 历史记录 ─────────────────────────────────────────────────
  sessions: {
    list(params?: { before?: string; limit?: number }): Promise<SessionListResponse> {
      if (MOCK) {
        return Promise.resolve({
          sessions: [
            {
              id: 'mock-1',
              startedAt: new Date(Date.now() - 3600000).toISOString(),
              endedAt: new Date(Date.now() - 3000000).toISOString(),
              totalSeconds: 600,
              goodSeconds: 480,
              badSeconds: 120,
            },
            {
              id: 'mock-2',
              startedAt: new Date(Date.now() - 7200000).toISOString(),
              endedAt: new Date(Date.now() - 6600000).toISOString(),
              totalSeconds: 600,
              goodSeconds: 300,
              badSeconds: 300,
            },
          ],
          hasMore: false,
        })
      }
      const qs = new URLSearchParams()
      if (params?.before) qs.set('before', params.before)
      if (params?.limit != null) qs.set('limit', String(params.limit))
      const query = qs.toString() ? `?${qs}` : ''
      return request<SessionListResponse>(`/sessions${query}`)
    },
  },
}
