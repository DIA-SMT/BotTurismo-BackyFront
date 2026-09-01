import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import type { BicitourParticipant, BicitourQuestion, BicitourSessionStop } from '@/lib/bicitour'
import { bumpSessionVersion, getSessionByCode } from '@/lib/bicitour-server'

export const runtime = 'nodejs'

// Respuesta de un participante. El puntaje se calcula acá, del lado seguro:
// el cliente solo manda la clave de la opción elegida. El UNIQUE
// (participant_id, question_id) de la base garantiza una única respuesta.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const session = await getSessionByCode(supabase, String(body.code || ''))
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'La sesión no está activa en este momento.' }, { status: 409 })
  }

  const token = String(body.token || '')
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'Identidad inválida. Volvé a ingresar con el código.' }, { status: 401 })
  }
  const { data: participantRow } = await supabase
    .from('bicitour_participants')
    .select('*')
    .eq('token', token)
    .eq('session_id', session.id)
    .maybeSingle()
  const participant = participantRow as BicitourParticipant | null
  if (!participant) {
    return NextResponse.json({ error: 'No estás registrado en esta sesión.' }, { status: 401 })
  }

  const questionId = Number(body.questionId)
  const answerKey = String(body.answerKey || '').slice(0, 12)
  if (!Number.isInteger(questionId) || !answerKey) {
    return NextResponse.json({ error: 'Respuesta inválida.' }, { status: 400 })
  }

  // La pregunta debe estar activa en una parada de ESTA sesión.
  const { data: sessionStopRow } = await supabase
    .from('bicitour_session_stops')
    .select('*')
    .eq('session_id', session.id)
    .eq('active_question_id', questionId)
    .eq('status', 'question_active')
    .maybeSingle()
  const sessionStop = sessionStopRow as BicitourSessionStop | null
  if (!sessionStop) {
    return NextResponse.json({ error: 'La pregunta ya no está abierta.' }, { status: 409 })
  }

  const { data: questionRow } = await supabase
    .from('bicitour_questions')
    .select('*')
    .eq('id', questionId)
    .single()
  const question = questionRow as BicitourQuestion | null
  if (!question || !question.options.some((option) => option.key === answerKey)) {
    return NextResponse.json({ error: 'Opción inválida.' }, { status: 400 })
  }

  const isCorrect = answerKey === question.correct_key
  const pointsAwarded = isCorrect ? question.points : 0

  const { error: insertError } = await supabase.from('bicitour_answers').insert({
    session_id: session.id,
    participant_id: participant.id,
    question_id: questionId,
    answer_key: answerKey,
    is_correct: isCorrect,
    points_awarded: pointsAwarded,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Ya respondiste esta pregunta.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo registrar tu respuesta.' }, { status: 500 })
  }

  if (pointsAwarded > 0) {
    await supabase
      .from('bicitour_participants')
      .update({ score: participant.score + pointsAwarded })
      .eq('id', participant.id)
  }
  await bumpSessionVersion(supabase, session.id)

  // No se revela si fue correcta: eso llega para todos cuando el guía cierra
  // la pregunta (la gracia es escuchar la explicación en grupo).
  return NextResponse.json({ data: { registered: true } }, { status: 201 })
}
