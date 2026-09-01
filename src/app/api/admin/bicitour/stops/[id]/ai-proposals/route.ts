import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourStop } from '@/lib/bicitour'
import {
  generateQuestionProposals,
  isBicitourAiConfigured,
  MAX_AI_PROPOSALS,
  type BicitourAiCategory,
  type BicitourAiDifficulty,
  type BicitourAiType,
} from '@/lib/bicitour-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

// Genera PROPUESTAS de preguntas con IA para una parada. Quedan en estado
// "pending": no forman parte del recorrido hasta la aprobación expresa de un
// administrador. Solo accesible con sesión de administrador.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  if (!isBicitourAiConfigured()) {
    return NextResponse.json(
      { error: 'IA no configurada: falta OPENROUTER_API_KEY en el servidor.', aiConfigured: false },
      { status: 503 },
    )
  }

  const { id } = await context.params
  const stopId = Number(id)
  if (!Number.isInteger(stopId)) return NextResponse.json({ error: 'Parada inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const count = Math.max(1, Math.min(MAX_AI_PROPOSALS, Number(body.count) || 3))
  const difficulty = ['facil', 'intermedia', 'dificil'].includes(String(body.difficulty))
    ? (String(body.difficulty) as BicitourAiDifficulty)
    : 'intermedia'
  const type = ['multiple_choice', 'true_false', 'mixta'].includes(String(body.type))
    ? (String(body.type) as BicitourAiType)
    : 'mixta'
  const category = ['historica', 'cultural', 'arquitectonica', 'observacion'].includes(String(body.category))
    ? (String(body.category) as BicitourAiCategory)
    : 'historica'

  const supabase = createServerSupabaseClient()
  const { data: stopRow } = await supabase.from('bicitour_stops').select('*').eq('id', stopId).maybeSingle()
  const stop = stopRow as BicitourStop | null
  if (!stop) return NextResponse.json({ error: 'Parada no encontrada.' }, { status: 404 })

  if (!stop.description && (!stop.fun_facts || stop.fun_facts.length === 0)) {
    return NextResponse.json(
      { error: 'La parada no tiene contenido histórico cargado: el asistente solo trabaja sobre el contenido aprobado.' },
      { status: 409 },
    )
  }

  const proposals = await generateQuestionProposals({ stop, count, difficulty, type, category })
  if (!proposals || proposals.length === 0) {
    return NextResponse.json(
      { error: 'El asistente no pudo generar propuestas válidas con el contenido disponible. Probá de nuevo o ampliá el contenido.' },
      { status: 502 },
    )
  }

  const { data: inserted, error } = await supabase
    .from('bicitour_question_proposals')
    .insert(
      proposals.map((proposal) => ({
        stop_id: stopId,
        type: proposal.type,
        prompt: proposal.prompt,
        options: proposal.options,
        correct_key: proposal.correctKey,
        explanation: proposal.explanation || null,
        difficulty: proposal.difficulty,
        category: proposal.category,
        source_excerpt: proposal.sourceExcerpt || null,
        warning: proposal.warning,
      })),
    )
    .select('*')

  if (error || !inserted) return NextResponse.json({ error: 'No se pudieron guardar las propuestas.' }, { status: 500 })
  return NextResponse.json({ data: inserted }, { status: 201 })
}
