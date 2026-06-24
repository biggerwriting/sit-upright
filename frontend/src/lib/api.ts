// frontend/src/lib/api.ts
import type { QuotaInfo, SessionId, SessionStats, User } from '@/types'

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
}
