import Link from 'next/link'
import type { QuotaBannerProps } from './types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}

export function QuotaBanner({ remainingSeconds, nearExpiry }: QuotaBannerProps) {
  const minutes = Math.floor(remainingSeconds / 60)

  if (remainingSeconds === 0) {
    return (
      <div className="w-full bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex justify-between items-center">
        <span>用量已耗尽</span>
        <Link href="/pricing" className="underline font-semibold">购买套餐</Link>
      </div>
    )
  }

  if (nearExpiry) {
    const nearMinutes = Math.floor(nearExpiry.seconds / 60)
    return (
      <div className="w-full bg-orange-50 border-b border-orange-200 px-4 py-2 text-sm text-orange-700 flex items-center gap-2">
        <span>⚠</span>
        <span data-testid="near-expiry">
          剩余用量：{minutes} 分钟（其中 {nearMinutes} 分钟将于 {formatDate(nearExpiry.expiresAt)} 到期）
        </span>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-50 border-b px-4 py-2 text-sm text-gray-600">
      剩余用量：{minutes} 分钟
    </div>
  )
}
