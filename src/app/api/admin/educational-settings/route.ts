import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { getEducationalSettings, saveEducationalSettings } from '@/lib/educational-settings-server'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const settings = await getEducationalSettings(supabase)
  return NextResponse.json({ data: settings })
}

export async function PUT(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const saved = await saveEducationalSettings(supabase, body)

  if (!saved) {
    return NextResponse.json(
      { error: 'No se pudo guardar la configuración. ¿Se corrió la migración supabase_admin_selfservice_migration.sql?' },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: saved })
}
