'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { PaymentModal } from '@/components/payment/PaymentModal'

export default function PricingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [orderId, setOrderId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBuy() {
    if (!user) {
      router.push('/login')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.payment.createOrder()
      setOrderId(res.orderId)
      setQrCode(res.qrCode)
    } catch {
      setError('创建订单失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  function handleSuccess() {
    setOrderId(null)
    router.push('/app')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold">套餐选择</h1>

      <div className="border rounded-2xl p-8 max-w-sm w-full text-center shadow">
        <h2 className="text-xl font-semibold mb-2">标准套餐</h2>
        <p className="text-gray-500 mb-4">7 天内 1 小时坐姿检测</p>
        <p className="text-4xl font-bold mb-6">¥9.9</p>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          onClick={handleBuy}
          disabled={loading}
          className="block w-full px-6 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 transition"
        >
          {loading ? '创建订单…' : '立即购买'}
        </button>
      </div>

      <p className="text-sm text-gray-400">新用户免费试用 5 分钟，无需注册</p>

      {orderId && (
        <PaymentModal
          orderId={orderId}
          qrCode={qrCode}
          onClose={() => setOrderId(null)}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  )
}
