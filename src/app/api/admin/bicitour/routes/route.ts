import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { sanitizePath, type BicitourRoute } from '@/lib/bicitour'

export const runtime = 'nodejs'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const [{ data: routes, error }, { data: stops }, { data: sessions }] = await Promise.all([
    supabase.from('bicitour_routes').select('*').order('updated_at', { ascending: false }),
    supabase.from('bicitour_stops').select('id,route_id'),
    supabase.from('bicitour_sessions').select('id,route_id,status'),
  ])
  if (error) return NextResponse.json({ error: 'No se pudieron obtener los recorridos.' }, { status: 500 })

  const stopCounts = new Map<number, number>()
  for (const stop of (stops || []) as { route_id: number }[]) {
    stopCounts.set(stop.route_id, (stopCounts.get(stop.route_id) || 0) + 1)
  }
  const sessionCounts = new Map<number, number>()
  const liveSessions = new Map<number, number>()
  for (const session of (sessions || []) as { route_id: number; status: string }[]) {
    sessionCounts.set(session.route_id, (sessionCounts.get(session.route_id) || 0) + 1)
    if (session.status !== 'finished') liveSessions.set(session.route_id, (liveSessions.get(session.route_id) || 0) + 1)
  }

  return NextResponse.json({
    data: ((routes || []) as BicitourRoute[]).map((route) => ({
      ...route,
      stopCount: stopCounts.get(route.id) || 0,
      sessionCount: sessionCounts.get(route.id) || 0,
      liveSessionCount: liveSessions.get(route.id) || 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const title = String(body.title || '').trim().slice(0, 120)
  if (title.length < 3) return NextResponse.json({ error: 'Ingresá un título para el recorrido.' }, { status: 400 })
  const mode = ['individual', 'teams', 'mixed'].includes(String(body.mode)) ? String(body.mode) : 'individual'

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bicitour_routes')
    .insert({
      title,
      description: String(body.description || '').trim() || null,
      mode,
      path: sanitizePath(body.path),
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: 'No se pudo crear el recorrido.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
