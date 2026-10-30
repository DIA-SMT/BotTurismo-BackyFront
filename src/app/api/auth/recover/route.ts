import { NextRequest, NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  // PUBLIC_SITE_URL primero: detrás de nginx el origen de la petición puede
  // ser el de Next (127.0.0.1:3004) y no el del sitio.
  const siteUrl = process.env.PUBLIC_SITE_URL || request.nextUrl.origin
  const result = await requestPasswordReset(String(email || ''), siteUrl)

  if (!result.ok) {
    return NextResponse.json({ error: 'No se pudo enviar el correo de recuperación.' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
