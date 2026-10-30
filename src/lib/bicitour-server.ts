import { getSql, pgErrorCode, rowValues } from '@/lib/db'
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

// Texto que Postgres no puede convertir al tipo de la columna (ej. un token
// con forma de UUID que no es un UUID válido).
const INVALID_TEXT_REPRESENTATION = '22P02'

// Un fallo al incrementar la versión no corta la acción que lo llamó.
export async function bumpSessionVersion(sessionId: number) {
  const sql = getSql()
  await sql`select bicitour_bump_version(p_session_id => ${sessionId})`.catch((error) => {
    console.error('Error incrementando la versión de la sesión de bicitour:', error)
  })
}

// La bitácora es informativa: si no se puede escribir, la acción sigue.
export async function logSessionEvent(sessionId: number, type: string, payload: Record<string, unknown> = {}) {
  const sql = getSql()
  await sql`insert into bicitour_session_events ${rowValues(sql, { session_id: sessionId, type, payload })}`.catch(
    (error) => {
      console.error('Error registrando un evento de la sesión de bicitour:', error)
    },
  )
}

export async function getSessionByCode(code: string) {
  const normalized = String(code || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{4,10}$/.test(normalized)) return null
  const sql = getSql()
  const [session] = await sql<BicitourSession[]>`select * from bicitour_sessions where code = ${normalized}`
  return session ?? null
}

// Participante de la sesión identificado por su token. Un token que pasa el
// filtro de forma de las rutas pero Postgres no acepta como uuid cuenta como
// "no registrado" (no como error del servidor).
export async function getParticipantByToken(sessionId: number, token: string) {
  const sql = getSql()
  try {
    const [participant] = await sql<BicitourParticipant[]>`
      select * from bicitour_participants where token = ${token} and session_id = ${sessionId}
    `
    return participant ?? null
  } catch (error) {
    if (pgErrorCode(error) === INVALID_TEXT_REPRESENTATION) return null
    throw error
  }
}

interface SessionGraph {
  session: BicitourSession
  route: BicitourRoute
  sessionStops: BicitourSessionStop[]
  stopsById: Map<number, BicitourStop>
  questionsByStop: Map<number, BicitourQuestion[]>
  participants: BicitourParticipant[]
}

export async function loadSessionGraph(session: BicitourSession): Promise<SessionGraph | null> {
  const sql = getSql()
  const [[route], sessionStops, participants] = await Promise.all([
    sql<BicitourRoute[]>`select * from bicitour_routes where id = ${session.route_id}`,
    sql<BicitourSessionStop[]>`select * from bicitour_session_stops where session_id = ${session.id} order by position`,
    sql<BicitourParticipant[]>`select * from bicitour_participants where session_id = ${session.id}`,
  ])
  if (!route) return null

  const stopIds = sessionStops.map((row) => row.stop_id)
  const stops: BicitourStop[] = stopIds.length
    ? await sql<BicitourStop[]>`select * from bicitour_stops where id in ${sql(stopIds)}`
    : []
  const questions: BicitourQuestion[] = stopIds.length
    ? await sql<BicitourQuestion[]>`select * from bicitour_questions where stop_id in ${sql(stopIds)} order by position`
    : []

  const stopsById = new Map<number, BicitourStop>()
  for (const stop of stops) stopsById.set(stop.id, stop)
  const questionsByStop = new Map<number, BicitourQuestion[]>()
  for (const question of questions) {
    const list = questionsByStop.get(question.stop_id) || []
    list.push(question)
    questionsByStop.set(question.stop_id, list)
  }

  return {
    session,
    route,
    sessionStops,
    stopsById,
    questionsByStop,
    participants,
  }
}

async function loadTrack(sessionId: number): Promise<[number, number][]> {
  const sql = getSql()
  const rows = await sql<{ lat: number; lng: number }[]>`
    select lat, lng from bicitour_track_points where session_id = ${sessionId} order by id limit 5000
  `
  return rows.map((point) => [point.lat, point.lng])
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
  graph: SessionGraph,
  participant: BicitourParticipant | null,
): Promise<ParticipantStateResponse> {
  const { session, route, sessionStops, stopsById, questionsByStop, participants } = graph
  const sql = getSql()

  const [track, myAnswers, myStamps, answerCountRows] = await Promise.all([
    loadTrack(session.id),
    participant
      ? sql<{ question_id: number; answer_key: string; is_correct: boolean }[]>`
          select question_id, answer_key, is_correct from bicitour_answers where participant_id = ${participant.id}
        `
      : Promise.resolve([]),
    participant
      ? sql<{ stop_id: number | null; label: string }[]>`
          select stop_id, label from bicitour_stamps where participant_id = ${participant.id}
        `
      : Promise.resolve([]),
    sql<{ question_id: number }[]>`select question_id from bicitour_answers where session_id = ${session.id}`,
  ])

  const answerCounts = new Map<number, number>()
  for (const row of answerCountRows) {
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
  const badgeData = participant ? await loadSessionBadgeData(session) : null
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
// Las escrituras que fallan se registran sin cortar la acción del guía.
export async function completeSessionStop(session: BicitourSession, sessionStop: BicitourSessionStop) {
  const sql = getSql()
  const [stop] = await sql<{ id: number; title: string }[]>`
    select id, title from bicitour_stops where id = ${sessionStop.stop_id}
  `
  const participants = await sql<{ id: number }[]>`select id from bicitour_participants where session_id = ${session.id}`

  await sql`
    update bicitour_session_stops
    set status = ${'completed'}, completed_at = ${new Date().toISOString()}
    where id = ${sessionStop.id}
  `.catch((error) => {
    console.error('Error completando la parada de la sesión de bicitour:', error)
  })

  if (stop && participants.length) {
    const stamps = participants.map((participant) => ({
      session_id: session.id,
      participant_id: participant.id,
      stop_id: stop.id,
      label: stop.title,
    }))
    await sql`
      insert into bicitour_stamps ${rowValues(sql, stamps)}
      on conflict (participant_id, stop_id) do nothing
    `.catch((error) => {
      console.error('Error repartiendo los sellos de la parada de bicitour:', error)
    })
  }

  await logSessionEvent(session.id, 'stop_completed', { sessionStopId: sessionStop.id })
}

// Cierre de sesión: bonificación grupal si el grupo completó todas las
// paradas (no omitidas) + recálculo final de insignias (la insignia
// "Recorrido completo" la otorga el módulo central de insignias).
// Las escrituras que fallan se registran sin cortar el cierre.
export async function finishSession(session: BicitourSession) {
  const sql = getSql()
  const stops = await sql<{ id: number; status: string }[]>`
    select id, status from bicitour_session_stops where session_id = ${session.id}
  `
  const relevant = stops.filter((stop) => stop.status !== 'skipped')
  const allCompleted = relevant.length > 0 && relevant.every((stop) => stop.status === 'completed')

  const participants = await sql<{ id: number; score: number }[]>`
    select id, score from bicitour_participants where session_id = ${session.id}
  `

  if (allCompleted && participants.length && !session.group_bonus_awarded) {
    for (const participant of participants) {
      await sql`
        update bicitour_participants
        set score = ${participant.score + BICITOUR_GROUP_BONUS_POINTS}
        where id = ${participant.id}
      `.catch((error) => {
        console.error('Error sumando la bonificación grupal de bicitour:', error)
      })
    }
  }

  await sql`
    update bicitour_sessions
    set status = ${'finished'},
      finished_at = ${new Date().toISOString()},
      gps_enabled = ${false},
      group_bonus_awarded = ${session.group_bonus_awarded || allCompleted}
    where id = ${session.id}
  `.catch((error) => {
    console.error('Error finalizando la sesión de bicitour:', error)
  })

  // Recalcular insignias con la sesión ya finalizada (idempotente).
  await awardSessionBadges({ ...session, status: 'finished' })

  await logSessionEvent(session.id, 'session_finished', { allCompleted })
}
