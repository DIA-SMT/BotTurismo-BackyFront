import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { sanitizePath } from '@/lib/bicitour'
import { isBicitourAiConfigured } from '@/lib/bicitour-ai'

export const runtime = 'nodejs'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const [{ data: route }, { data: stops }] = await Promise.all([
    supabase.from('bicitour_routes').select('*').eq('id', routeId).maybeSingle(),
    supabase.from('bicitour_stops').select('*').eq('route_id', routeId).order('position'),
  ])
  if (!route) return NextResponse.json({ error: 'Recorrido no encontrado.' }, { status: 404 })

  const stopIds = (stops || []).map((stop) => stop.id)
  const [{ data: questions }, { data: proposals }] = stopIds.length
    ? await Promise.all([
        supabase.from('bicitour_questions').select('*').in('stop_id', stopIds).order('position'),
        supabase
          .from('bicitour_question_proposals')
          .select('*')
          .in('stop_id', stopIds)
          .eq('status', 'pending')
          .order('created_at'),
      ])
    : [{ data: [] }, { data: [] }]

  return NextResponse.json({
    data: {
      route,
      stops: stops || [],
      questions: questions || [],
      proposals: proposals || [],
      aiConfigured: isBicitourAiConfigured(),
    },
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120)
    if (title.length < 3) return NextResponse.json({ error: 'El título es muy corto.' }, { status: 400 })
    payload.title = title
  }
  if (body.description !== undefined) payload.description = String(body.description).trim() || null
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }
    payload.status = body.status
  }
  if (body.mode !== undefined) {
    if (!['individual', 'teams', 'mixed'].includes(String(body.mode))) {
      return NextResponse.json({ error: 'Modalidad inválida.' }, { status: 400 })
    }
    payload.mode = body.mode
  }
  if (body.path !== undefined) payload.path = sanitizePath(body.path)

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.from('bicitour_routes').update(payload).eq('id', routeId).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar el recorrido.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { count } = await supabase
    .from('bicitour_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', routeId)
  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: 'El recorrido tiene sesiones registradas. Archivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('bicitour_routes').delete().eq('id', routeId)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el recorrido.' }, { status: 500 })
  return NextResponse.json({ data: { id: routeId } })
}
