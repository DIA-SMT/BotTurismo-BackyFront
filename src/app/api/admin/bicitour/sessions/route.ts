import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import {
  generateSessionCode,
  sanitizeStringArray,
  type BicitourRoute,
  type BicitourSession,
  type BicitourStop,
} from '@/lib/bicitour'
import { logSessionEvent } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Historial de sesiones con estadísticas básicas.
export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const sql = getSql()
  const [sessions, routes, participants, answers] = await Promise.all([
    sql<BicitourSession[]>`select * from bicitour_sessions order by created_at desc limit 100`,
    sql<{ id: number; title: string }[]>`select id, title from bicitour_routes`,
    sql<{ id: number; session_id: number; score: number }[]>`select id, session_id, score from bicitour_participants`,
    sql<{ session_id: number; is_correct: boolean }[]>`select session_id, is_correct from bicitour_answers`,
  ])

  const routeTitles = new Map<number, string>(routes.map((route) => [route.id, route.title]))
  const participantStats = new Map<number, { count: number; totalScore: number }>()
  for (const participant of participants) {
    const entry = participantStats.get(participant.session_id) || { count: 0, totalScore: 0 }
    entry.count += 1
    entry.totalScore += participant.score
    participantStats.set(participant.session_id, entry)
  }
  const answerStats = new Map<number, { total: number; correct: number }>()
  for (const answer of answers) {
    const entry = answerStats.get(answer.session_id) || { total: 0, correct: 0 }
    entry.total += 1
    if (answer.is_correct) entry.correct += 1
    answerStats.set(answer.session_id, entry)
  }

  return NextResponse.json({
    data: sessions.map((session) => ({
      ...session,
      routeTitle: routeTitles.get(session.route_id) || `Recorrido #${session.route_id}`,
      participantCount: participantStats.get(session.id)?.count || 0,
      averageScore: participantStats.get(session.id)?.count
        ? Math.round((participantStats.get(session.id)!.totalScore || 0) / participantStats.get(session.id)!.count)
        : 0,
      answers: answerStats.get(session.id)?.total || 0,
      correctAnswers: answerStats.get(session.id)?.correct || 0,
    })),
  })
}

// Crea una sesión en vivo a partir de un recorrido: copia sus paradas como
// paradas de sesión (bloqueadas) y genera el código corto del QR.
export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const routeId = Number(body.routeId)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const sql = getSql()
  const [route] = await sql<BicitourRoute[]>`select * from bicitour_routes where id = ${routeId}`
  if (!route) return NextResponse.json({ error: 'Recorrido no encontrado.' }, { status: 404 })
  if (route.status === 'archived') {
    return NextResponse.json({ error: 'El recorrido está archivado.' }, { status: 409 })
  }

  const routeStops = await sql<BicitourStop[]>`
    select * from bicitour_stops where route_id = ${routeId} and is_draft = ${false} order by position
  `
  if (routeStops.length === 0) {
    return NextResponse.json({ error: 'El recorrido no tiene paradas cargadas.' }, { status: 409 })
  }

  const mode = ['individual', 'teams', 'mixed'].includes(String(body.mode)) ? String(body.mode) : route.mode
  let teams = sanitizeStringArray(body.teams, 8, 30)
  if (mode !== 'individual' && teams.length < 2) teams = ['Naranjas', 'Azules']
  if (mode === 'individual') teams = []

  // Código único: reintenta ante la improbable colisión.
  let session: BicitourSession | null = null
  for (let attempt = 0; attempt < 5 && !session; attempt += 1) {
    try {
      const [created] = await sql<BicitourSession[]>`
        insert into bicitour_sessions ${rowValues(sql, { code: generateSessionCode(), route_id: routeId, mode, teams })}
        returning *
      `
      session = created ?? null
    } catch (error) {
      if (pgErrorCode(error) !== UNIQUE_VIOLATION) {
        return NextResponse.json({ error: 'No se pudo crear la sesión.' }, { status: 500 })
      }
    }
  }
  if (!session) return NextResponse.json({ error: 'No se pudo generar el código de la sesión.' }, { status: 500 })

  const sessionId = session.id
  await sql`
    insert into bicitour_session_stops ${rowValues(
      sql,
      routeStops.map((stop, index) => ({
        session_id: sessionId,
        stop_id: stop.id,
        position: index + 1,
      })),
    )}
  `.catch((error) => {
    console.error('Error copiando las paradas a la sesión de bicitour:', error)
  })
  await logSessionEvent(session.id, 'session_created', { routeId, mode })

  return NextResponse.json({ data: session }, { status: 201 })
}
