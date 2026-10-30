import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies, resetPasswordWithToken, setAdminPassword } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const { password, token } = await request.json()
  const nextPassword = String(password || '')

  if (nextPassword.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  // Desde el link del mail de recuperación.
  if (token) {
    const admin = await resetPasswordWithToken(String(token), nextPassword)
    if (!admin) {
      return NextResponse.json({ error: 'El link venció o ya se usó. Pedí uno nuevo.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  // Con la sesión abierta (clave temporal o cambio voluntario).
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  await setAdminPassword(admin.user.id, nextPassword, admin.sessionId)
  return NextResponse.json({ ok: true })
}
