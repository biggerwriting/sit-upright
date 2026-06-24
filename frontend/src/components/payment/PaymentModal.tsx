'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api'

type Props = {
  orderId: string
  qrCode: string
  onClose(): void
  onSuccess(): void
}

const POLL_INTERVAL_MS = 3000

export function PaymentModal({ orderId, qrCode, onClose, onSuccess }: Props) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [failed, setFailed] = useState(false)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    timerRef.current = setInterval(async () => {
      try {
        const order = await api.payment.getOrder(orderId)
        if (order.status === 'paid') {
          stopPolling()
          onSuccess()
        } else if (order.status === 'failed') {
          stopPolling()
          // Show error state
          setFailed(true)
        }
      } catch {
        // 轮询失败静默处理
      }
    }, POLL_INTERVAL_MS)

    return stopPolling
  }, [orderId, onSuccess, stopPolling])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
        <h2 className="text-xl font-bold mb-1">扫码支付</h2>
        <p className="text-3xl font-bold text-green-600 mb-4">¥9.9</p>

        {!failed && (
          <div className="flex justify-center mb-4">
            <QRCodeSVG value={qrCode} size={200} />
          </div>
        )}

        <p className="text-sm text-gray-500 mb-1">7天内1小时坐姿检测服务</p>
        <p className="text-sm text-gray-400 mb-6">请用支付宝扫码</p>

        {failed ? (
          <div className="mb-4">
            <p className="text-red-500 text-sm mb-2">支付失败，请重新尝试</p>
            <button
              onClick={() => { stopPolling(); onClose() }}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
              aria-label="关闭"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-4">
              <span className="animate-spin">○</span>
              <span>等待支付…</span>
            </div>

            <button
              onClick={() => { stopPolling(); onClose() }}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
              aria-label="关闭"
            >
              关闭
            </button>
          </>
        )}
      </div>
    </div>
  )
}
