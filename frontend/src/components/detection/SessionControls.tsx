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
