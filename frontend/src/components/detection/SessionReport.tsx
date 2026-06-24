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
