import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { sanitizeQuestionOptions, type BicitourQuestion } from '@/lib/bicitour'

export const runtime = 'nodejs'

const TRUE_FALSE_OPTIONS = [
  { key: 'true', label: 'Verdadero' },
  { key: 'false', label: 'Falso' },
]

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const stopId = Number(body.stopId)
  const prompt = String(body.prompt || '').trim().slice(0, 500)
  const type = body.type === 'true_false' ? 'true_false' : 'multiple_choice'
  if (!Number.isInteger(stopId)) return NextResponse.json({ error: 'Parada inválida.' }, { status: 400 })
  if (prompt.length < 5) return NextResponse.json({ error: 'Escribí la pregunta.' }, { status: 400 })

  const options = type === 'true_false' ? TRUE_FALSE_OPTIONS : sanitizeQuestionOptions(body.options)
  if (type === 'multiple_choice' && options.length < 2) {
    return NextResponse.json({ error: 'Cargá al menos 2 opciones.' }, { status: 400 })
  }
  const correctKey = String(body.correctKey || '').trim()
  if (!options.some((option) => option.key === correctKey)) {
    return NextResponse.json({ error: 'Marcá cuál es la respuesta correcta.' }, { status: 400 })
  }
  const points = Number.isInteger(Number(body.points)) && Number(body.points) > 0 ? Math.min(Number(body.points), 1000) : 100
  const category = ['historica', 'cultural', 'arquitectonica', 'observacion'].includes(String(body.category))
    ? String(body.category)
    : undefined

  const sql = getSql()
  const [last] = await sql<{ position: number }[]>`
    select position from bicitour_questions where stop_id = ${stopId} order by position desc limit 1
  `

  const insertPayload: Record<string, unknown> = {
    stop_id: stopId,
    position: Number(last?.position || 0) + 1,
    type,
    prompt,
    options,
    correct_key: correctKey,
    explanation: String(body.explanation || '').trim() || null,
    points,
  }
  // Columna de la migración v2: solo se envía si el cliente la especifica.
  if (category) insertPayload.category = category

  const [data] = await sql<BicitourQuestion[]>`
    insert into bicitour_questions ${rowValues(sql, insertPayload)} returning *
  `.catch(() => [])

  if (!data) return NextResponse.json({ error: 'No se pudo crear la pregunta.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
