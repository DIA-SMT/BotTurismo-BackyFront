import { NextRequest, NextResponse } from 'next/server'
import { getAdminProfile } from '@/lib/admin-auth'
import { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, getCookieOptions, getSessionMaxAge, signInAdmin } from '@/lib/admin-auth-core'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()
  const { data, error } = await signInAdmin(String(email || ''), String(password || ''))

  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 })
  }

  const profile = await getAdminProfile(data.user.id)
  if (!profile) {
    return NextResponse.json({ error: 'El usuario no está habilitado para el panel.' }, { status: 403 })
  }

  const response = NextResponse.json({
    ok: true,
    mustChangePassword: profile.must_change_password,
  })

  response.cookies.set(ADMIN_ACCESS_COOKIE, data.session.access_token, getCookieOptions(getSessionMaxAge(data.session)))
  response.cookies.set(ADMIN_REFRESH_COOKIE, data.session.refresh_token, getCookieOptions(60 * 60 * 24 * 30))

  return response
}
