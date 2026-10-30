import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { sanitizeQuestionOptions, type BicitourQuestion, type BicitourQuestionProposal } from '@/lib/bicitour'

export const runtime = 'nodejs'

// Decisión del administrador sobre una propuesta generada por IA:
//  - approve: valida (con las ediciones del admin, si las hubo) y la copia a
//    bicitour_questions con origin='ai'. Recién ahí forma parte del recorrido.
//  - reject: la marca rechazada, nunca llega a publicarse.
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const proposalId = Number(id)
  if (!Number.isInteger(proposalId)) return NextResponse.json({ error: 'Propuesta inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }
  const action = String(body.action || '')

  const sql = getSql()
  const [proposal] = await sql<BicitourQuestionProposal[]>`
    select * from bicitour_question_proposals where id = ${proposalId}
  `
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 })
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'La propuesta ya fue decidida.' }, { status: 409 })
  }

  if (action === 'reject') {
    const [data] = await sql<BicitourQuestionProposal[]>`
      update bicitour_question_proposals
      set status = ${'rejected'}, decided_at = ${new Date().toISOString()}
      where id = ${proposalId}
      returning *
    `.catch(() => [])
    if (!data) return NextResponse.json({ error: 'No se pudo rechazar la propuesta.' }, { status: 500 })
    return NextResponse.json({ data })
  }

  if (action !== 'approve') return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })

  // Ediciones del administrador sobre el borrador (opcionales).
  const prompt = String(body.prompt ?? proposal.prompt).trim().slice(0, 500)
  const explanation = String(body.explanation ?? proposal.explanation ?? '').trim().slice(0, 600) || null
  const options =
    proposal.type === 'true_false'
      ? proposal.options
      : body.options !== undefined
        ? sanitizeQuestionOptions(body.options)
        : proposal.options
  const correctKey = String(body.correctKey ?? proposal.correct_key).trim()
  const points = Number.isInteger(Number(body.points)) && Number(body.points) > 0 ? Math.min(Number(body.points), 1000) : 100

  if (prompt.length < 5) return NextResponse.json({ error: 'La pregunta es muy corta.' }, { status: 400 })
  if (!Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: 'La propuesta necesita al menos 2 opciones.' }, { status: 400 })
  }
  if (!options.some((option: { key: string }) => option.key === correctKey)) {
    return NextResponse.json({ error: 'La respuesta correcta no coincide con las opciones.' }, { status: 400 })
  }

  const [last] = await sql<{ position: number }[]>`
    select position from bicitour_questions where stop_id = ${proposal.stop_id} order by position desc limit 1
  `

  const [question] = await sql<BicitourQuestion[]>`
    insert into bicitour_questions ${rowValues(sql, {
      stop_id: proposal.stop_id,
      position: Number(last?.position || 0) + 1,
      type: proposal.type,
      prompt,
      options,
      correct_key: correctKey,
      explanation,
      points,
      origin: 'ai',
      category: proposal.category,
      source_excerpt: proposal.source_excerpt,
    })}
    returning *
  `.catch(() => [])
  if (!question) {
    return NextResponse.json({ error: 'No se pudo publicar la pregunta aprobada.' }, { status: 500 })
  }

  await sql`
    update bicitour_question_proposals
    set status = ${'approved'}, decided_at = ${new Date().toISOString()}
    where id = ${proposalId}
  `.catch((error) => {
    console.error('Error marcando como aprobada la propuesta de bicitour:', error)
  })

  return NextResponse.json({ data: { question } })
}
