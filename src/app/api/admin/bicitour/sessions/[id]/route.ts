import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { decimateTrack, type BicitourSession } from '@/lib/bicitour'
import { loadSessionGraph } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

const CONNECTED_WINDOW_MS = 15_000

// Estado completo para el panel del guía (con ?since= para poll liviano).
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const sessionId = Number(id)
  if (!Number.isInteger(sessionId)) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: sessionRow } = await supabase.from('bicitour_sessions').select('*').eq('id', sessionId).maybeSingle()
  const session = sessionRow as BicitourSession | null
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const since = Number(searchParams.get('since') || 0)
  if (since > 0 && Number(session.version) === since) {
    return NextResponse.json({ version: session.version, unchanged: true })
  }

  const graph = await loadSessionGraph(supabase, session)
  if (!graph) return NextResponse.json({ error: 'Sesión no disponible.' }, { status: 500 })

  const [{ data: answers }, { data: trackRows }, { data: badgeRows }] = await Promise.all([
    supabase.from('bicitour_answers').select('question_id').eq('session_id', session.id),
    supabase.from('bicitour_track_points').select('lat,lng').eq('session_id', session.id).order('id').limit(5000),
    supabase.from('bicitour_participant_badges').select('participant_id').eq('session_id', session.id),
  ])
  const badgeCounts = new Map<number, number>()
  for (const badge of (badgeRows || []) as { participant_id: number }[]) {
    badgeCounts.set(badge.participant_id, (badgeCounts.get(badge.participant_id) || 0) + 1)
  }
  const answerCounts = new Map<number, number>()
  for (const answer of (answers || []) as { question_id: number }[]) {
    answerCounts.set(answer.question_id, (answerCounts.get(answer.question_id) || 0) + 1)
  }
  const track = ((trackRows || []) as { lat: number; lng: number }[]).map(
    (point) => [point.lat, point.lng] as [number, number],
  )

  const now = Date.now()
  const participants = graph.participants
    .map((participant) => ({
      id: participant.id,
      nickname: participant.nickname,
      team: participant.team,
      score: participant.score,
      badgeCount: badgeCounts.get(participant.id) || 0,
      connected: now - new Date(participant.last_seen_at).getTime() < CONNECTED_WINDOW_MS,
    }))
    .sort((a, b) => b.score - a.score)

  const teamTotals = new Map<string, number>()
  for (const participant of participants) {
    if (participant.team) teamTotals.set(participant.team, (teamTotals.get(participant.team) || 0) + participant.score)
  }

  return NextResponse.json({
    version: session.version,
    session,
    route: { id: graph.route.id, title: graph.route.title, path: graph.route.path || [] },
    stops: graph.sessionStops.map((sessionStop) => {
      const stop = graph.stopsById.get(sessionStop.stop_id)
      const questions = graph.questionsByStop.get(sessionStop.stop_id) || []
      return {
        sessionStopId: sessionStop.id,
        stopId: sessionStop.stop_id,
        position: sessionStop.position,
        status: sessionStop.status,
        activeQuestionId: sessionStop.active_question_id,
        title: stop?.title || `Parada ${sessionStop.position}`,
        lat: stop?.lat ?? 0,
        lng: stop?.lng ?? 0,
        radiusM: stop?.radius_m ?? 60,
        hint: stop?.hint || null,
        questions: questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          correctKey: question.correct_key,
          answeredCount: answerCounts.get(question.id) || 0,
        })),
      }
    }),
    participants,
    connectedCount: participants.filter((participant) => participant.connected).length,
    badgesAwarded: (badgeRows || []).length,
    track: decimateTrack(track),
    trackCount: track.length,
    teamRanking: [...teamTotals.entries()].map(([team, score]) => ({ team, score })).sort((a, b) => b.score - a.score),
  })
}
