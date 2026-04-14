import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAdminProfile } from '@/lib/admin-auth'
import { ADMIN_ACCESS_COOKIE, updatePasswordWithRecoveryTokens, verifyAccessToken } from '@/lib/admin-auth-core'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function POST(request: NextRequest) {
  const { password, accessToken, refreshToken } = await request.json()
  const nextPassword = String(password || '')

  if (nextPassword.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
  }

  if (accessToken && refreshToken) {
    const { data, error } = await updatePasswordWithRecoveryTokens(String(accessToken), String(refreshToken), nextPassword)
    if (error || !data.user) {
      return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    await supabase.from('admin_profiles').update({ must_change_password: false }).eq('id', data.user.id)
    return NextResponse.json({ ok: true })
  }

  const cookieStore = await cookies()
  const sessionAccessToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value
  if (!sessionAccessToken) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  const user = await verifyAccessToken(sessionAccessToken)
  if (!user) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  const profile = await getAdminProfile(user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Usuario no habilitado.' }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: nextPassword,
  })

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar la contraseña.' }, { status: 400 })
  }

  await supabase.from('admin_profiles').update({ must_change_password: false }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
