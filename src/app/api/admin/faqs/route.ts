import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('categoria', { ascending: true })
    .order('orden', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'No se pudieron obtener las preguntas frecuentes.' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const payload = await request.json()
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('faqs')
    .insert({
      pregunta: payload.pregunta,
      respuesta: payload.respuesta,
      categoria: payload.categoria,
      activo: payload.activo ?? true,
      orden: payload.orden ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'No se pudo crear la pregunta frecuente.' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
