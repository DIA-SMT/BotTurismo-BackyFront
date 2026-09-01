// ── Sistema de insignias del Bicitour ────────────────────────────────
// ÚNICO lugar donde viven las definiciones y reglas de las insignias.
// Las funciones de evaluación son puras (sin base de datos) para poder
// testearlas de forma aislada; el otorgamiento idempotente vive en
// bicitour-badges-server.ts. No agregar porcentajes ni reglas en otros
// componentes: para una insignia nueva, sumar una entrada acá.

export type BicitourBadgeKey = 'historiador' | 'explorador' | 'ojo_de_aguila' | 'recorrido_completo'

export interface BicitourBadgeDefinition {
  key: BicitourBadgeKey
  name: string
  emoji: string
  description: string
}

export const BICITOUR_BADGE_DEFINITIONS: BicitourBadgeDefinition[] = [
  {
    key: 'historiador',
    name: 'Historiador',
    emoji: '📜',
    description: 'Respondé bien al menos el 80% de tus respuestas (mínimo 3 preguntas).',
  },
  {
    key: 'explorador',
    name: 'Explorador',
    emoji: '🧭',
    description: 'Completá al menos el 75% de las paradas del recorrido.',
  },
  {
    key: 'ojo_de_aguila',
    name: 'Ojo de Águila',
    emoji: '🦅',
    description: 'Acertá todas las preguntas de observación del recorrido.',
  },
  {
    key: 'recorrido_completo',
    name: 'Recorrido completo',
    emoji: '🏅',
    description: 'Terminá la sesión con el sello de todas las paradas.',
  },
]

// Umbrales (centralizados, no repetir en componentes)
const HISTORIADOR_MIN_ANSWERS = 3
const HISTORIADOR_MIN_RATIO = 0.8
const EXPLORADOR_MIN_RATIO = 0.75

// ── Entrada de evaluación (datos ya cargados, sin acceso a base) ──

export interface BadgeParticipantInput {
  /** Respuestas del participante, con la categoría de cada pregunta. */
  answers: { isCorrect: boolean; category: string }[]
  /** Cantidad de paradas con sello obtenido por el participante. */
  stampedStops: number
}

export interface BadgeSessionInput {
  /** Paradas publicadas de la sesión (excluye omitidas). */
  publishedStops: number
  /**
   * Preguntas de categoría "observacion" que efectivamente se lanzaron en la
   * sesión (ids). Ojo de Águila exige acertarlas TODAS y requiere al menos una.
   */
  observationQuestionIds: number[]
  /** Ids de pregunta de observación respondidos correctamente por el participante. */
  observationCorrectIds: number[]
  sessionFinished: boolean
}

export interface EarnedBadge {
  key: BicitourBadgeKey
  reason: string
}

// Evalúa TODAS las insignias para un participante. Determinista y pura.
export function evaluateBadges(participant: BadgeParticipantInput, session: BadgeSessionInput): EarnedBadge[] {
  const earned: EarnedBadge[] = []

  // Historiador: >= 80% correctas sobre lo respondido, con mínimo 3 respuestas.
  const total = participant.answers.length
  const correct = participant.answers.filter((answer) => answer.isCorrect).length
  if (total >= HISTORIADOR_MIN_ANSWERS && correct / total >= HISTORIADOR_MIN_RATIO) {
    earned.push({ key: 'historiador', reason: `Respondió bien ${correct} de ${total} preguntas` })
  }

  // Explorador: >= 75% de las paradas publicadas con sello.
  if (session.publishedStops > 0 && participant.stampedStops / session.publishedStops >= EXPLORADOR_MIN_RATIO) {
    earned.push({
      key: 'explorador',
      reason: `Completó ${participant.stampedStops} de ${session.publishedStops} paradas`,
    })
  }

  // Ojo de Águila: todas las preguntas de observación lanzadas, correctas.
  // Solo aplica si el recorrido tuvo al menos una pregunta de observación.
  if (session.observationQuestionIds.length > 0) {
    const correctSet = new Set(session.observationCorrectIds)
    const allCorrect = session.observationQuestionIds.every((id) => correctSet.has(id))
    if (allCorrect) {
      earned.push({
        key: 'ojo_de_aguila',
        reason: `Acertó las ${session.observationQuestionIds.length} preguntas de observación`,
      })
    }
  }

  // Recorrido completo: sesión finalizada + sello de todas las paradas publicadas.
  if (session.sessionFinished && session.publishedStops > 0 && participant.stampedStops >= session.publishedStops) {
    earned.push({ key: 'recorrido_completo', reason: 'Terminó el recorrido con todas las paradas selladas' })
  }

  return earned
}

// ── Progreso hacia cada insignia (para la sección "Mis insignias") ──

export interface BadgeProgressRow {
  key: BicitourBadgeKey
  name: string
  emoji: string
  description: string
  earned: boolean
  /** 0..1 para la barra de progreso. */
  progress: number
  progressText: string
}

export function buildBadgeProgress(
  participant: BadgeParticipantInput,
  session: BadgeSessionInput,
  earnedKeys: Set<string>,
): BadgeProgressRow[] {
  const total = participant.answers.length
  const correct = participant.answers.filter((answer) => answer.isCorrect).length
  const observationTotal = session.observationQuestionIds.length
  const observationCorrect = session.observationQuestionIds.filter((id) =>
    session.observationCorrectIds.includes(id),
  ).length

  const rows: Record<BicitourBadgeKey, { progress: number; progressText: string }> = {
    historiador: {
      progress: total === 0 ? 0 : Math.min(1, (correct / Math.max(total, HISTORIADOR_MIN_ANSWERS)) / HISTORIADOR_MIN_RATIO),
      progressText: `${correct}/${total} correctas (mínimo ${HISTORIADOR_MIN_ANSWERS} respuestas)`,
    },
    explorador: {
      progress: session.publishedStops === 0 ? 0 : Math.min(1, participant.stampedStops / session.publishedStops / EXPLORADOR_MIN_RATIO),
      progressText: `${participant.stampedStops}/${session.publishedStops} paradas`,
    },
    ojo_de_aguila: {
      progress: observationTotal === 0 ? 0 : observationCorrect / observationTotal,
      progressText:
        observationTotal === 0
          ? 'Este recorrido no tiene preguntas de observación'
          : `${observationCorrect}/${observationTotal} de observación correctas`,
    },
    recorrido_completo: {
      progress: session.publishedStops === 0 ? 0 : Math.min(1, participant.stampedStops / session.publishedStops),
      progressText: `${participant.stampedStops}/${session.publishedStops} sellos`,
    },
  }

  return BICITOUR_BADGE_DEFINITIONS.map((definition) => {
    const earned = earnedKeys.has(definition.key)
    const row = rows[definition.key]
    return {
      ...definition,
      earned,
      progress: earned ? 1 : Math.max(0, Math.min(1, row.progress)),
      progressText: row.progressText,
    }
  })
}

export function badgeDefinition(key: string): BicitourBadgeDefinition | null {
  return BICITOUR_BADGE_DEFINITIONS.find((definition) => definition.key === key) || null
}
