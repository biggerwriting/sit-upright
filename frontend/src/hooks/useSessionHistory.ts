'use client'
import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { SessionListItem } from '@/types'

const LIMIT = 10

export function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const before = sessions.length > 0
        ? sessions[sessions.length - 1].startedAt
        : undefined
      const data = await api.sessions.list({ before, limit: LIMIT })
      setSessions(prev => [...prev, ...data.sessions])
      setHasMore(data.hasMore)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, sessions])

  // 首次加载
  useEffect(() => {
    loadMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { sessions, loading, hasMore, loadMore }
}
