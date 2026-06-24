import type { AlertBannerProps } from './types'

export function AlertBanner({ show }: AlertBannerProps) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                    bg-red-500 text-white px-6 py-3 rounded-full
                    shadow-lg text-base font-semibold animate-bounce">
      ⚠ 请注意坐姿
    </div>
  )
}
