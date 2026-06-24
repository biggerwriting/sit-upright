import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '坐姿检测 — PostureMonitor',
  description: '通过摄像头实时检测坐姿，智能提醒，守护脊椎健康。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
