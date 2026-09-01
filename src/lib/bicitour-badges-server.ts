import type { SupabaseClient } from '@supabase/supabase-js'
import type { BicitourSession } from '@/lib/bicitour'
import {
  buildBadgeProgress,
  evaluateBadges,
  type BadgeParticipantInput,
  type BadgeProgressRow,
  type BadgeSessionInput,
  type EarnedBadge,
} from '@/lib/bicitour-badges'

// Otorgamiento server-side de insignias. Idempotente: el UNIQUE
// (participant_id, badge_key) de la base garantiza que una insignia no se
// entrega dos veces, y volver a recalcular nunca quita lo ya otorgado.

interface SessionBadgeData {
  sessionInput: Omit<BadgeSessionInput, 'observationCorrectIds'>
  perParticipant: Map<number, { input: BadgeParticipantInput; observationCorrectIds: number[] }>
  earnedByParticipant: Map<number, { badge_key: string; reason: string; awarded_at: string }[]>
}

export async function loadSessionBadgeData(
  supabase: SupabaseClient,
  session: BicitourSession,
): Promise<SessionBadgeData> {
  const [{ data: sessionStops }, { data: participants }, { data: answers }, { data: stamps }, { data: badges }] =
    await Promise.all([
      supabase
        .from('bicitour_session_stops')
        .select('id,stop_id,status,active_question_id')
        .eq('session_id', session.id),
      supabase.from('bicitour_participants').select('id').eq('session_id', session.id),
      supabase.from('bicitour_answers').select('participant_id,question_id,is_correct').eq('session_id', session.id),
      supabase.from('bicitour_stamps').select('participant_id,stop_id').eq('session_id', session.id),
      supabase
        .from('bicitour_participant_badges')
        .select('participant_id,badge_key,reason,awarded_at')
        .eq('session_id', session.id),
    ])

  // Categorías de las preguntas efectivamente lanzadas en la sesión.
  const askedQuestionIds = [
    ...new Set(
      ((sessionStops || []) as { active_question_id: number | null }[])
        .map((stop) => stop.active_question_id)
        .filter((id): id is number => id !== null),
    ),
  ]
  // También cuentan las preguntas ya respondidas (cubre preguntas lanzadas
  // en paradas cuya pregunta activa cambió después).
  for (const answer of (answers || []) as { question_id: number }[]) {
    if (!askedQuestionIds.includes(answer.question_id)) askedQuestionIds.push(answer.question_id)
  }

  const { data: questionRows } = askedQuestionIds.length
    ? await supabase.from('bicitour_questions').select('id,category').in('id', askedQuestionIds)
    : { data: [] }
  const categoryByQuestion = new Map<number, string>()
  for (const question of (questionRows || []) as { id: number; category: string }[]) {
    categoryByQuestion.set(question.id, question.category || 'historica')
  }
  const observationQuestionIds = askedQuestionIds.filter(
    (id) => categoryByQuestion.get(id) === 'observacion',
  )

  const publishedStops = ((sessionStops || []) as { status: string }[]).filter(
    (stop) => stop.status !== 'skipped',
  ).length

  const sessionInput = {
    publishedStops,
    observationQuestionIds,
    sessionFinished: session.status === 'finished',
  }

  const perParticipant = new Map<number, { input: BadgeParticipantInput; observationCorrectIds: number[] }>()
  for (const participant of (participants || []) as { id: number }[]) {
    const myAnswers = ((answers || []) as { participant_id: number; question_id: number; is_correct: boolean }[]).filter(
      (answer) => answer.participant_id === participant.id,
    )
    const myStamps = ((stamps || []) as { participant_id: number; stop_id: number | null }[]).filter(
      (stamp) => stamp.participant_id === participant.id && stamp.stop_id !== null,
    )
    perParticipant.set(participant.id, {
      input: {
        answers: myAnswers.map((answer) => ({
          isCorrect: answer.is_correct,
          category: categoryByQuestion.get(answer.question_id) || 'historica',
        })),
        stampedStops: myStamps.length,
      },
      observationCorrectIds: myAnswers
        .filter((answer) => answer.is_correct && categoryByQuestion.get(answer.question_id) === 'observacion')
        .map((answer) => answer.question_id),
    })
  }

  const earnedByParticipant = new Map<number, { badge_key: string; reason: string; awarded_at: string }[]>()
  for (const badge of (badges || []) as { participant_id: number; badge_key: string; reason: string; awarded_at: string }[]) {
    const list = earnedByParticipant.get(badge.participant_id) || []
    list.push(badge)
    earnedByParticipant.set(badge.participant_id, list)
  }

  return { sessionInput, perParticipant, earnedByParticipant }
}

// Recalcula y otorga las insignias de TODOS los participantes de la sesión.
// Se llama al cerrar preguntas, completar paradas y finalizar la sesión.
// Devuelve cuántas insignias nuevas se entregaron (para bumpear la versión).
export async function awardSessionBadges(supabase: SupabaseClient, session: BicitourSession): Promise<number> {
  const data = await loadSessionBadgeData(supabase, session)
  const rows: { session_id: number; participant_id: number; badge_key: string; reason: string }[] = []

  for (const [participantId, participantData] of data.perParticipant) {
    const already = new Set((data.earnedByParticipant.get(participantId) || []).map((badge) => badge.badge_key))
    const earned: EarnedBadge[] = evaluateBadges(participantData.input, {
      ...data.sessionInput,
      observationCorrectIds: participantData.observationCorrectIds,
    })
    for (const badge of earned) {
      if (!already.has(badge.key)) {
        rows.push({ session_id: session.id, participant_id: participantId, badge_key: badge.key, reason: badge.reason })
      }
    }
  }

  if (rows.length > 0) {
    // ignoreDuplicates: dos recalculos simultáneos no duplican (UNIQUE).
    await supabase
      .from('bicitour_participant_badges')
      .upsert(rows, { onConflict: 'participant_id,badge_key', ignoreDuplicates: true })
  }
  return rows.length
}

// Progreso de insignias de UN participante (para el estado del polling).
export function buildParticipantBadgeView(
  data: SessionBadgeData,
  participantId: number,
): {
  earned: { key: string; name: string; emoji: string; reason: string; awardedAt: string }[]
  progress: BadgeProgressRow[]
} {
  const participantData = data.perParticipant.get(participantId)
  const earnedRows = data.earnedByParticipant.get(participantId) || []
  const earnedKeys = new Set(earnedRows.map((badge) => badge.badge_key))

  const progress = participantData
    ? buildBadgeProgress(
        participantData.input,
        { ...data.sessionInput, observationCorrectIds: participantData.observationCorrectIds },
        earnedKeys,
      )
    : []

  return {
    earned: earnedRows.map((badge) => {
      const definition = progress.find((row) => row.key === badge.badge_key)
      return {
        key: badge.badge_key,
        name: definition?.name || badge.badge_key,
        emoji: definition?.emoji || '🎖',
        reason: badge.reason,
        awardedAt: badge.awarded_at,
      }
    }),
    progress,
  }
}
