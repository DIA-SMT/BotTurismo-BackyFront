import { NextRequest, NextResponse } from 'next/server'
import { signInAdmin } from '@/lib/admin-auth'
import { ADMIN_SESSION_COOKIE, LEGACY_ADMIN_COOKIES, getCookieOptions } from '@/lib/admin-auth-core'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  const clientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const result = await signInAdmin(String(email || ''), String(password || ''), clientIp)

  if (!result.ok) {
    if (result.reason === 'throttled') {
      return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 })
  }

  const response = NextResponse.json({
    ok: true,
    mustChangePassword: result.profile.must_change_password,
  })

  response.cookies.set(ADMIN_SESSION_COOKIE, result.token, getCookieOptions(result.maxAge))
  for (const name of LEGACY_ADMIN_COOKIES) response.cookies.delete(name)

  return response
}
