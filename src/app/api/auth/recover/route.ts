import { NextRequest, NextResponse } from 'next/server'
import { sendRecoveryEmail } from '@/lib/admin-auth-core'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  const origin = request.nextUrl.origin
  const { error } = await sendRecoveryEmail(String(email || ''), `${origin}/update-password`)

  if (error) {
    return NextResponse.json({ error: 'No se pudo enviar el correo de recuperación.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
