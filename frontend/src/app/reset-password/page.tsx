'use client'
import { useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.auth.resetPassword(token, password)
      router.push('/login?reset=success')
    } catch {
      setError('重置链接无效或已过期，请重新申请')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <p className="text-red-500">
        无效的重置链接。{' '}
        <Link href="/forgot-password" className="underline">
          重新申请
        </Link>
      </p>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold mb-6 text-center">设置新密码</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="新密码（至少 8 位）"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 transition"
        >
          {loading ? '重置中…' : '重置密码'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<p>加载中…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  )
}
