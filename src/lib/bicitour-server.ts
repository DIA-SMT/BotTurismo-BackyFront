import type { SupabaseClient } from '@supabase/supabase-js'
import { awardSessionBadges, buildParticipantBadgeView, loadSessionBadgeData } from '@/lib/bicitour-badges-server'
import {
  BICITOUR_GROUP_BONUS_POINTS,
  decimateTrack,
  trackDistanceKm,
  type BicitourParticipant,
  type BicitourQuestion,
  type BicitourRoute,
  type BicitourSession,
  type BicitourSessionStop,
  type BicitourStop,
  type ParticipantRankingRow,
  type ParticipantStateResponse,
  type ParticipantStopView,
} from '@/lib/bicitour'

// Toda la lógica de puntaje/sellos vive del lado del servidor: el navegador
// solo manda intenciones (responder "b", abrir parada) y el backend decide.

export async function bumpSessionVersion(supabase: SupabaseClient, sessionId: number) {
  await supabase.rpc('bicitour_bump_version', { p_session_id: sessionId }).then(async (result) => {
    // Si la función RPC no existe (migración vieja), fallback con update simple.
    if (result.error) {
      const { data } = await supabase.from('bicitour_sessions').select('version').eq('id', sessionId).single()
      await supabase
        .from('bicitour_sessions')
        .update({ version: Number(data?.version || 0) + 1 })
        .eq('id', sessionId)
    }
  })
}

export async function logSessionEvent(
  supabase: SupabaseClient,
  sessionId: number,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await supabase.from('bicitour_session_events').insert({ session_id: sessionId, type, payload })
}

export async function getSessionByCode(supabase: SupabaseClient, code: string) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4,10}$/.test(normalized)) return null
  const { data } = await supabase.from('bicitour_sessions').select('*').eq('code', normalized).maybeSingle()
  return (data as BicitourSession) || null
}

interface SessionGraph {
  session: BicitourSession
  route: BicitourRoute
  sessionStops: BicitourSessionStop[]
  stopsById: Map<number, BicitourStop>
  questionsByStop: Map<number, BicitourQuestion[]>
  participants: BicitourParticipant[]
}

export async function loadSessionGraph(supabase: SupabaseClient, session: BicitourSession): Promise<SessionGraph | null> {
  const [{ data: route }, { data: sessionStops }, { data: participants }] = await Promise.all([
    supabase.from('bicitour_routes').select('*').eq('id', session.route_id).single(),
    supabase.from('bicitour_session_stops').select('*').eq('session_id', session.id).order('position'),
    supabase.from('bicitour_participants').select('*').eq('session_id', session.id),
  ])
  if (!route) return null

  const stopIds = (sessionStops || []).map((row) => row.stop_id)
  const { data: stops } = stopIds.length
    ? await supabase.from('bicitour_stops').select('*').in('id', stopIds)
    : { data: [] }
  const { data: questions } = stopIds.length
    ? await supabase.from('bicitour_questions').select('*').in('stop_id', stopIds).order('position')
    : { data: [] }

  const stopsById = new Map<number, BicitourStop>()
  for (const stop of (stops || []) as BicitourStop[]) stopsById.set(stop.id, stop)
  const questionsByStop = new Map<number, BicitourQuestion[]>()
  for (const question of (questions || []) as BicitourQuestion[]) {
    const list = questionsByStop.get(question.stop_id) || []
    list.push(question)
    questionsByStop.set(question.stop_id, list)
  }

  return {
    session,
    route: route as BicitourRoute,
    sessionStops: (sessionStops || []) as BicitourSessionStop[],
    stopsById,
    questionsByStop,
    participants: (participants || []) as BicitourParticipant[],
  }
}

async function loadTrack(supabase: SupabaseClient, sessionId: number): Promise<[number, number][]> {
  const { data } = await supabase
    .from('bicitour_track_points')
    .select('lat,lng')
    .eq('session_id', sessionId)
    .order('id')
    .limit(5000)
  return ((data || []) as { lat: number; lng: number }[]).map((point) => [point.lat, point.lng])
}

function buildRanking(participants: BicitourParticipant[], meId: number | null): ParticipantRankingRow[] {
  const sorted = [...participants].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
  const top = sorted.slice(0, 10)
  const rows = top.map((participant) => ({
    nickname: participant.nickname,
    team: participant.team,
    score: participant.score,
    isMe: participant.id === meId,
  }))
  if (meId && !top.some((participant) => participant.id === meId)) {
    const me = sorted.find((participant) => participant.id === meId)
    if (me) rows.push({ nickname: me.nickname, team: me.team, score: me.score, isMe: true })
  }
  return rows
}

function buildTeamRanking(participants: BicitourParticipant[]) {
  const byTeam = new Map<string, { score: number; members: number }>()
  for (const participant of participants) {
    if (!participant.team) continue
    const entry = byTeam.get(participant.team) || { score: 0, members: 0 }
    entry.score += participant.score
    entry.members += 1
    byTeam.set(participant.team, entry)
  }
  return [...byTeam.entries()]
    .map(([team, entry]) => ({ team, ...entry }))
    .sort((a, b) => b.score - a.score)
}

// Estado completo que ve un participante. `participant` puede ser null
// (alguien mirando el lobby sin haberse unido todavía no existe: join es
// obligatorio, así que siempre hay participante).
export async function buildParticipantState(
  supabase: SupabaseClient,
  graph: SessionGraph,
  participant: BicitourParticipant | null,
): Promise<ParticipantStateResponse> {
  const { session, route, sessionStops, stopsById, questionsByStop, participants } = graph

  const [track, answersResult, stampsResult, answerCountsResult] = await Promise.all([
    loadTrack(supabase, session.id),
    participant
      ? supabase.from('bicitour_answers').select('question_id,answer_key,is_correct').eq('participant_id', participant.id)
      : Promise.resolve({ data: [] }),
    participant
      ? supabase.from('bicitour_stamps').select('stop_id,label').eq('participant_id', participant.id)
      : Promise.resolve({ data: [] }),
    supabase.from('bicitour_answers').select('question_id').eq('session_id', session.id),
  ])

  const myAnswers = (answersResult.data || []) as { question_id: number; answer_key: string; is_correct: boolean }[]
  const myStamps = (stampsResult.data || []) as { stop_id: number | null; label: string }[]
  const answerCounts = new Map<number, number>()
  for (const row of (answerCountsResult.data || []) as { question_id: number }[]) {
    answerCounts.set(row.question_id, (answerCounts.get(row.question_id) || 0) + 1)
  }

  const stopViews: ParticipantStopView[] = []
  let openStop: ParticipantStopView | null = null
  let myAnswerKey: string | null = null
  let hint: string | null = null

  for (const sessionStop of sessionStops) {
    const stop = stopsById.get(sessionStop.stop_id)
    if (!stop) continue
    const view: ParticipantStopView = {
      sessionStopId: sessionStop.id,
      stopId: stop.id,
      position: sessionStop.position,
      title: stop.title,
      status: sessionStop.status,
      lat: stop.lat,
      lng: stop.lng,
    }

    // El contenido histórico solo viaja cuando el guía abrió la parada.
    if (sessionStop.status !== 'locked' && sessionStop.status !== 'skipped') {
      view.content = {
        description: stop.description,
        funFacts: stop.fun_facts || [],
        imageUrls: stop.image_urls || [],
        audioUrl: stop.audio_url,
      }
    }

    const stopQuestions = questionsByStop.get(stop.id) || []
    const activeQuestion = sessionStop.active_question_id
      ? stopQuestions.find((question) => question.id === sessionStop.active_question_id)
      : null

    if (sessionStop.status === 'question_active' && activeQuestion) {
      view.question = {
        id: activeQuestion.id,
        type: activeQuestion.type,
        prompt: activeQuestion.prompt,
        options: activeQuestion.options,
        points: activeQuestion.points,
        answeredCount: answerCounts.get(activeQuestion.id) || 0,
      }
    }

    if ((sessionStop.status === 'question_closed' || sessionStop.status === 'completed') && activeQuestion) {
      view.reveal = {
        questionId: activeQuestion.id,
        correctKey: activeQuestion.correct_key,
        explanation: activeQuestion.explanation,
        prompt: activeQuestion.prompt,
        options: activeQuestion.options,
      }
    }

    if (['open', 'question_active', 'question_closed'].includes(sessionStop.status)) {
      openStop = view
      if (activeQuestion) {
        myAnswerKey = myAnswers.find((answer) => answer.question_id === activeQuestion.id)?.answer_key ?? null
      }
    }

    stopViews.push(view)
  }

  // Pista del PRÓXIMO DESTINO: la pista pertenece a la parada de destino,
  // así que se muestra la de la primera parada todavía bloqueada (al iniciar
  // es la primera del recorrido; al completar una, se desbloquea la de la
  // siguiente). Solo si esa parada tiene pista activa.
  const completedViews = stopViews.filter((view) => view.status === 'completed')
  if (!openStop && session.status !== 'finished') {
    const nextLocked = stopViews.find((view) => view.status === 'locked')
    if (nextLocked) {
      const nextStop = stopsById.get(nextLocked.stopId)
      hint = nextStop && nextStop.hint_enabled !== false && nextStop.hint ? nextStop.hint : null
    }
  }

  const completed = completedViews.length
  const decimated = decimateTrack(track)

  // Insignias del participante (otorgadas + progreso hacia las pendientes).
  const badgeData = participant ? await loadSessionBadgeData(supabase, session) : null
  const badgeView = badgeData && participant ? buildParticipantBadgeView(badgeData, participant.id) : null

  // Posición en el ranking general (1 = primero).
  const sortedByScore = [...participants].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
  const myPosition = participant ? sortedByScore.findIndex((row) => row.id === participant.id) + 1 : 0

  return {
    version: session.version,
    session: {
      status: session.status,
      mode: session.mode,
      teams: session.teams || [],
      routeTitle: route.title,
      gpsActive: session.gps_enabled,
      announcement:
        session.announcement && session.announcement_at
          ? { text: session.announcement, at: session.announcement_at }
          : null,
    },
    stops: stopViews,
    openStop,
    myAnswerKey,
    hint,
    path: route.path || [],
    track: decimated,
    progress: { completed, total: stopViews.length },
    me: participant
      ? {
          nickname: participant.nickname,
          team: participant.team,
          score: participant.score,
          position: myPosition,
          stamps: myStamps.map((stamp) => ({ stopId: stamp.stop_id, label: stamp.label })),
          correctAnswers: myAnswers.filter((answer) => answer.is_correct).length,
          totalAnswers: myAnswers.length,
          badges: badgeView?.earned || [],
          badgeProgress: badgeView?.progress || [],
        }
      : undefined,
    ranking: buildRanking(participants, participant?.id ?? null),
    teamRanking: session.mode !== 'individual' ? buildTeamRanking(participants) : [],
    summary:
      session.status === 'finished'
        ? {
            distanceKm: trackDistanceKm(track),
            stopsCompleted: completed,
            totalStops: stopViews.length,
          }
        : null,
  }
}

// Marca una parada como completada y reparte sellos a todos los participantes
// de la sesión (el sello es por participar de la parada; los puntos vienen de
// las respuestas). Idempotente gracias al UNIQUE (participant_id, stop_id).
export async function completeSessionStop(
  supabase: SupabaseClient,
  session: BicitourSession,
  sessionStop: BicitourSessionStop,
) {
  const { data: stop } = await supabase.from('bicitour_stops').select('id,title').eq('id', sessionStop.stop_id).single()
  const { data: participants } = await supabase
    .from('bicitour_participants')
    .select('id')
    .eq('session_id', session.id)

  await supabase
    .from('bicitour_session_stops')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionStop.id)

  if (stop && participants?.length) {
    await supabase.from('bicitour_stamps').upsert(
      participants.map((participant) => ({
        session_id: session.id,
        participant_id: participant.id,
        stop_id: stop.id,
        label: stop.title,
      })),
      { onConflict: 'participant_id,stop_id', ignoreDuplicates: true },
    )
  }

  await logSessionEvent(supabase, session.id, 'stop_completed', { sessionStopId: sessionStop.id })
}

// Cierre de sesión: bonificación grupal si el grupo completó todas las
// paradas (no omitidas) + recálculo final de insignias (la insignia
// "Recorrido completo" la otorga el módulo central de insignias).
export async function finishSession(supabase: SupabaseClient, session: BicitourSession) {
  const { data: sessionStops } = await supabase
    .from('bicitour_session_stops')
    .select('id,status')
    .eq('session_id', session.id)
  const stops = (sessionStops || []) as { id: number; status: string }[]
  const relevant = stops.filter((stop) => stop.status !== 'skipped')
  const allCompleted = relevant.length > 0 && relevant.every((stop) => stop.status === 'completed')

  const { data: participants } = await supabase
    .from('bicitour_participants')
    .select('id,score')
    .eq('session_id', session.id)

  if (allCompleted && participants?.length && !session.group_bonus_awarded) {
    for (const participant of participants) {
      await supabase
        .from('bicitour_participants')
        .update({ score: participant.score + BICITOUR_GROUP_BONUS_POINTS })
        .eq('id', participant.id)
    }
  }

  await supabase
    .from('bicitour_sessions')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      gps_enabled: false,
      group_bonus_awarded: session.group_bonus_awarded || allCompleted,
    })
    .eq('id', session.id)

  // Recalcular insignias con la sesión ya finalizada (idempotente).
  await awardSessionBadges(supabase, { ...session, status: 'finished' })

  await logSessionEvent(supabase, session.id, 'session_finished', { allCompleted })
}
