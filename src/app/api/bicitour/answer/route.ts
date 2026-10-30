import { NextRequest, NextResponse } from 'next/server'
import { getSql, pgErrorCode, rowValues, UNIQUE_VIOLATION } from '@/lib/db'
import type { BicitourQuestion, BicitourSessionStop } from '@/lib/bicitour'
import { bumpSessionVersion, getParticipantByToken, getSessionByCode } from '@/lib/bicitour-server'

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

  const sql = getSql()
  const session = await getSessionByCode(String(body.code || ''))
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada.' }, { status: 404 })
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'La sesión no está activa en este momento.' }, { status: 409 })
  }

  const token = String(body.token || '')
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'Identidad inválida. Volvé a ingresar con el código.' }, { status: 401 })
  }
  const participant = await getParticipantByToken(session.id, token)
  if (!participant) {
    return NextResponse.json({ error: 'No estás registrado en esta sesión.' }, { status: 401 })
  }

  const questionId = Number(body.questionId)
  const answerKey = String(body.answerKey || '').slice(0, 12)
  if (!Number.isInteger(questionId) || !answerKey) {
    return NextResponse.json({ error: 'Respuesta inválida.' }, { status: 400 })
  }

  // La pregunta debe estar activa en una parada de ESTA sesión.
  const [sessionStop] = await sql<BicitourSessionStop[]>`
    select * from bicitour_session_stops
    where session_id = ${session.id} and active_question_id = ${questionId} and status = ${'question_active'}
  `
  if (!sessionStop) {
    return NextResponse.json({ error: 'La pregunta ya no está abierta.' }, { status: 409 })
  }

  const [question] = await sql<BicitourQuestion[]>`select * from bicitour_questions where id = ${questionId}`
  if (!question || !question.options.some((option) => option.key === answerKey)) {
    return NextResponse.json({ error: 'Opción inválida.' }, { status: 400 })
  }

  const isCorrect = answerKey === question.correct_key
  const pointsAwarded = isCorrect ? question.points : 0

  try {
    await sql`
      insert into bicitour_answers ${rowValues(sql, {
        session_id: session.id,
        participant_id: participant.id,
        question_id: questionId,
        answer_key: answerKey,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
      })}
    `
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: 'Ya respondiste esta pregunta.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo registrar tu respuesta.' }, { status: 500 })
  }

  if (pointsAwarded > 0) {
    await sql`
      update bicitour_participants set score = ${participant.score + pointsAwarded} where id = ${participant.id}
    `.catch((error) => {
      console.error('Error sumando el puntaje del participante de bicitour:', error)
    })
  }
  await bumpSessionVersion(session.id)

  // No se revela si fue correcta: eso llega para todos cuando el guía cierra
  // la pregunta (la gracia es escuchar la explicación en grupo).
  return NextResponse.json({ data: { registered: true } }, { status: 201 })
}
