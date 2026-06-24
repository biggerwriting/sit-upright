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
