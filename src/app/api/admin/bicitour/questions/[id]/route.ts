import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/server-supabase'
import { sanitizeQuestionOptions } from '@/lib/bicitour'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const questionId = Number(id)
  if (!Number.isInteger(questionId)) return NextResponse.json({ error: 'Pregunta inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (body.prompt !== undefined) {
    const prompt = String(body.prompt).trim().slice(0, 500)
    if (prompt.length < 5) return NextResponse.json({ error: 'La pregunta es muy corta.' }, { status: 400 })
    payload.prompt = prompt
  }
  if (body.options !== undefined) {
    const options = sanitizeQuestionOptions(body.options)
    if (options.length < 2) return NextResponse.json({ error: 'Cargá al menos 2 opciones.' }, { status: 400 })
    payload.options = options
  }
  if (body.correctKey !== undefined) payload.correct_key = String(body.correctKey).trim()
  if (body.explanation !== undefined) payload.explanation = String(body.explanation).trim() || null
  if (body.points !== undefined) {
    const points = Number(body.points)
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      return NextResponse.json({ error: 'El puntaje debe estar entre 1 y 1000.' }, { status: 400 })
    }
    payload.points = points
  }
  if (body.category !== undefined) {
    if (!['historica', 'cultural', 'arquitectonica', 'observacion'].includes(String(body.category))) {
      return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 })
    }
    payload.category = body.category
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bicitour_questions')
    .update(payload)
    .eq('id', questionId)
    .select('*')
    .single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo actualizar la pregunta.' }, { status: 500 })

  // Consistencia: la clave correcta debe existir entre las opciones finales.
  const options = data.options as { key: string }[]
  if (!options.some((option) => option.key === data.correct_key)) {
    return NextResponse.json(
      { error: 'La respuesta correcta no coincide con ninguna opción. Revisala.', data },
      { status: 400 },
    )
  }
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const questionId = Number(id)
  if (!Number.isInteger(questionId)) return NextResponse.json({ error: 'Pregunta inválida.' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { count } = await supabase
    .from('bicitour_answers')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', questionId)
  if ((count || 0) > 0) {
    return NextResponse.json({ error: 'La pregunta ya tiene respuestas registradas. No se puede eliminar.' }, { status: 409 })
  }

  const { error } = await supabase.from('bicitour_questions').delete().eq('id', questionId)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar la pregunta.' }, { status: 500 })
  return NextResponse.json({ data: { id: questionId } })
}
