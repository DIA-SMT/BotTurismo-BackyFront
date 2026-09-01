import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { generateSessionCode, sanitizeStringArray, type BicitourRoute, type BicitourStop } from '@/lib/bicitour'
import { logSessionEvent } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Historial de sesiones con estadísticas básicas.
export async function GET() {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const [{ data: sessions }, { data: routes }, { data: participants }, { data: answers }] = await Promise.all([
    supabase.from('bicitour_sessions').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('bicitour_routes').select('id,title'),
    supabase.from('bicitour_participants').select('id,session_id,score'),
    supabase.from('bicitour_answers').select('session_id,is_correct'),
  ])

  const routeTitles = new Map((routes || []).map((route) => [route.id, route.title]))
  const participantStats = new Map<number, { count: number; totalScore: number }>()
  for (const participant of (participants || []) as { session_id: number; score: number }[]) {
    const entry = participantStats.get(participant.session_id) || { count: 0, totalScore: 0 }
    entry.count += 1
    entry.totalScore += participant.score
    participantStats.set(participant.session_id, entry)
  }
  const answerStats = new Map<number, { total: number; correct: number }>()
  for (const answer of (answers || []) as { session_id: number; is_correct: boolean }[]) {
    const entry = answerStats.get(answer.session_id) || { total: 0, correct: 0 }
    entry.total += 1
    if (answer.is_correct) entry.correct += 1
    answerStats.set(answer.session_id, entry)
  }

  return NextResponse.json({
    data: (sessions || []).map((session) => ({
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

  const supabase = createServerSupabaseClient()
  const { data: routeRow } = await supabase.from('bicitour_routes').select('*').eq('id', routeId).maybeSingle()
  const route = routeRow as BicitourRoute | null
  if (!route) return NextResponse.json({ error: 'Recorrido no encontrado.' }, { status: 404 })
  if (route.status === 'archived') {
    return NextResponse.json({ error: 'El recorrido está archivado.' }, { status: 409 })
  }

  const { data: stops } = await supabase
    .from('bicitour_stops')
    .select('*')
    .eq('route_id', routeId)
    .eq('is_draft', false)
    .order('position')
  const routeStops = (stops || []) as BicitourStop[]
  if (routeStops.length === 0) {
    return NextResponse.json({ error: 'El recorrido no tiene paradas cargadas.' }, { status: 409 })
  }

  const mode = ['individual', 'teams', 'mixed'].includes(String(body.mode)) ? String(body.mode) : route.mode
  let teams = sanitizeStringArray(body.teams, 8, 30)
  if (mode !== 'individual' && teams.length < 2) teams = ['Naranjas', 'Azules']
  if (mode === 'individual') teams = []

  // Código único: reintenta ante la improbable colisión.
  let session = null
  for (let attempt = 0; attempt < 5 && !session; attempt += 1) {
    const { data, error } = await supabase
      .from('bicitour_sessions')
      .insert({ code: generateSessionCode(), route_id: routeId, mode, teams })
      .select('*')
      .single()
    if (!error && data) session = data
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: 'No se pudo crear la sesión.' }, { status: 500 })
    }
  }
  if (!session) return NextResponse.json({ error: 'No se pudo generar el código de la sesión.' }, { status: 500 })

  await supabase.from('bicitour_session_stops').insert(
    routeStops.map((stop, index) => ({
      session_id: session.id,
      stop_id: stop.id,
      position: index + 1,
    })),
  )
  await logSessionEvent(supabase, session.id, 'session_created', { routeId, mode })

  return NextResponse.json({ data: session }, { status: 201 })
}
