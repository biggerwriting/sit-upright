import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 text-center">
      <h1 className="text-4xl font-bold">坐姿检测</h1>
      <p className="text-gray-600 max-w-md">
        通过摄像头实时检测坐姿，弓腰时立即提醒。AI 在浏览器本地运行，视频不上传。
      </p>
      <div className="flex gap-4">
        <Link
          href="/app"
          className="px-6 py-3 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition"
        >
          免费试用 5 分钟
        </Link>
        <Link
          href="/pricing"
          className="px-6 py-3 rounded-full border hover:bg-gray-50 transition"
        >
          查看定价
        </Link>
      </div>
    </main>
  )
}
