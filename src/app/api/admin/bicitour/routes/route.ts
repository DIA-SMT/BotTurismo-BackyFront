import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { sanitizePath, type BicitourRoute } from '@/lib/bicitour'

export const runtime = 'nodejs'

export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const sql = getSql()
  const result = await Promise.all([
    sql<BicitourRoute[]>`select * from bicitour_routes order by updated_at desc`,
    sql<{ id: number; route_id: number }[]>`select id, route_id from bicitour_stops`,
    sql<{ id: number; route_id: number; status: string }[]>`select id, route_id, status from bicitour_sessions`,
  ]).catch(() => null)
  if (!result) return NextResponse.json({ error: 'No se pudieron obtener los recorridos.' }, { status: 500 })
  const [routes, stops, sessions] = result

  const stopCounts = new Map<number, number>()
  for (const stop of stops) {
    stopCounts.set(stop.route_id, (stopCounts.get(stop.route_id) || 0) + 1)
  }
  const sessionCounts = new Map<number, number>()
  const liveSessions = new Map<number, number>()
  for (const session of sessions) {
    sessionCounts.set(session.route_id, (sessionCounts.get(session.route_id) || 0) + 1)
    if (session.status !== 'finished') liveSessions.set(session.route_id, (liveSessions.get(session.route_id) || 0) + 1)
  }

  return NextResponse.json({
    data: routes.map((route) => ({
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

  const sql = getSql()
  const [data] = await sql<BicitourRoute[]>`
    insert into bicitour_routes ${rowValues(sql, {
      title,
      description: String(body.description || '').trim() || null,
      mode,
      path: sanitizePath(body.path),
    })}
    returning *
  `.catch(() => [])

  if (!data) return NextResponse.json({ error: 'No se pudo crear el recorrido.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
