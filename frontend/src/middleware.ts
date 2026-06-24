import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: ['/app/:path*', '/history/:path*'],
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-key-please-change-in-production-32chars'
    )
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    // Token 无效或过期
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
