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
