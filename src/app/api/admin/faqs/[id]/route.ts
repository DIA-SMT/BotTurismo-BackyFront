import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const payload = await request.json()
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('faqs')
    .update(payload)
    .eq('id', Number(id))
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo actualizar la pregunta frecuente.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('faqs').delete().eq('id', Number(id))

  if (error) {
    return NextResponse.json({ error: 'No se pudo eliminar la pregunta frecuente.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
