'use client'
import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.push('/app')
    } catch {
      setError('邮箱或密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">登录</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {error && (
            <p role="alert" className="text-red-500 text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 transition"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm space-y-1">
          <p>
            <Link href="/forgot-password" className="text-green-600 hover:underline">
              忘记密码？
            </Link>
          </p>
          <p>
            没有账号？{' '}
            <Link href="/signup" className="text-green-600 hover:underline">
              注册
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
