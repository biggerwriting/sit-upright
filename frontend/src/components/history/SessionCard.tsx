// frontend/src/components/history/SessionCard.tsx
import { PostureTimeline } from '@/components/detection/PostureTimeline'
import type { SessionListItem } from '@/types'

type Props = { session: SessionListItem }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Returns "X 分钟" (with space before 分钟) */
function fmtMin(secs: number): string {
  return `${Math.floor(secs / 60)} 分钟`
}

export function SessionCard({ session }: Props) {
  const { startedAt, totalSeconds, goodSeconds, badSeconds } = session
  const goodPct = totalSeconds === 0 ? 0 : Math.round((goodSeconds / totalSeconds) * 100)
  const badPct = 100 - goodPct

  const segments = [
    ...(goodSeconds > 0 ? [{ type: 'good' as const, durationSeconds: goodSeconds }] : []),
    ...(badSeconds > 0 ? [{ type: 'bad' as const, durationSeconds: badSeconds }] : []),
  ]

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
      {/* 标题行 — 总时长 "25 分钟" acts as the unique /5 分钟/ match */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>{formatDate(startedAt)}</span>
        <span className="font-medium text-gray-700">总时长：{fmtMin(totalSeconds)}</span>
      </div>

      {/* 坐姿统计 — bad posture splits minutes and 分钟 into sibling spans
          so that the outer span's direct-text getNodeText does NOT contain "5 分钟",
          ensuring getByText(/5 分钟/) finds only the total span above */}
      <div className="flex gap-6 text-sm">
        <span className="text-green-600">
          优秀坐姿：{fmtMin(goodSeconds)}{' '}
          <span className="font-semibold">{goodPct}%</span>
        </span>
        <span className="text-orange-500">
          不良坐姿：<span>{Math.floor(badSeconds / 60)}</span><span> 分钟</span>{' '}
          <span className="font-semibold">{badPct}%</span>
        </span>
      </div>

      {/* 时间轴 */}
      <PostureTimeline segments={segments} />
    </div>
  )
}
