'use client'
import { useEffect, useRef } from 'react'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { SessionCard } from '@/components/history/SessionCard'

export default function HistoryPage() {
  const { sessions, loading, hasMore, loadMore } = useSessionHistory()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver 监听哨兵元素
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">历史记录</h1>

      {sessions.length === 0 && !loading && (
        <p className="text-gray-400 text-center py-16">暂无检测记录</p>
      )}

      <div className="space-y-4">
        {sessions.map(s => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>

      {/* 哨兵元素 */}
      <div ref={sentinelRef} className="h-4" />

      {loading && (
        <p className="text-center text-gray-400 py-4">加载中…</p>
      )}

      {!hasMore && sessions.length > 0 && (
        <p className="text-center text-gray-400 py-4 text-sm">已加载全部记录</p>
      )}
    </main>
  )
}
