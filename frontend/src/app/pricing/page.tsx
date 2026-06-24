import Link from 'next/link'

export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-bold">套餐选择</h1>

      <div className="border rounded-2xl p-8 max-w-sm w-full text-center shadow">
        <h2 className="text-xl font-semibold mb-2">标准套餐</h2>
        <p className="text-gray-500 mb-4">7 天内 1 小时坐姿检测</p>
        <p className="text-4xl font-bold mb-6">¥9.9</p>
        <Link
          href="/signup"
          className="block px-6 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition"
        >
          立即购买
        </Link>
      </div>

      <p className="text-sm text-gray-400">新用户免费试用 5 分钟，无需注册</p>
    </main>
  )
}
