import Link from 'next/link'
import type { QuotaBannerProps } from './types'

export function QuotaBanner({ remainingSeconds }: QuotaBannerProps) {
  const minutes = Math.floor(remainingSeconds / 60)

  if (remainingSeconds === 0) {
    return (
      <div className="w-full bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800 flex justify-between items-center">
        <span>用量已耗尽</span>
        <Link href="/pricing" className="underline font-semibold">购买套餐</Link>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-50 border-b px-4 py-2 text-sm text-gray-600">
      剩余用量：{minutes} 分钟
    </div>
  )
}
