import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import {
  sanitizePath,
  type BicitourQuestion,
  type BicitourQuestionProposal,
  type BicitourRoute,
  type BicitourStop,
} from '@/lib/bicitour'
import { isBicitourAiConfigured } from '@/lib/bicitour-ai'

export const runtime = 'nodejs'

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const sql = getSql()
  const [[route], stops] = await Promise.all([
    sql<BicitourRoute[]>`select * from bicitour_routes where id = ${routeId}`,
    sql<BicitourStop[]>`select * from bicitour_stops where route_id = ${routeId} order by position`,
  ])
  if (!route) return NextResponse.json({ error: 'Recorrido no encontrado.' }, { status: 404 })

  const stopIds = stops.map((stop) => stop.id)
  const [questions, proposals]: [BicitourQuestion[], BicitourQuestionProposal[]] = stopIds.length
    ? await Promise.all([
        sql<BicitourQuestion[]>`select * from bicitour_questions where stop_id in ${sql(stopIds)} order by position`,
        sql<BicitourQuestionProposal[]>`
          select * from bicitour_question_proposals
          where stop_id in ${sql(stopIds)} and status = ${'pending'}
          order by created_at
        `,
      ])
    : [[], []]

  return NextResponse.json({
    data: {
      route,
      stops,
      questions,
      proposals,
      aiConfigured: isBicitourAiConfigured(),
    },
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 120)
    if (title.length < 3) return NextResponse.json({ error: 'El título es muy corto.' }, { status: 400 })
    payload.title = title
  }
  if (body.description !== undefined) payload.description = String(body.description).trim() || null
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
    }
    payload.status = body.status
  }
  if (body.mode !== undefined) {
    if (!['individual', 'teams', 'mixed'].includes(String(body.mode))) {
      return NextResponse.json({ error: 'Modalidad inválida.' }, { status: 400 })
    }
    payload.mode = body.mode
  }
  if (body.path !== undefined) payload.path = sanitizePath(body.path)

  const sql = getSql()
  const [data] = await sql<BicitourRoute[]>`
    update bicitour_routes set ${rowValues(sql, payload)} where id = ${routeId} returning *
  `.catch(() => [])
  if (!data) return NextResponse.json({ error: 'No se pudo actualizar el recorrido.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const routeId = Number(id)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })

  const sql = getSql()
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from bicitour_sessions where route_id = ${routeId}
  `
  if (count > 0) {
    return NextResponse.json(
      { error: 'El recorrido tiene sesiones registradas. Archivalo en lugar de eliminarlo.' },
      { status: 409 },
    )
  }

  try {
    await sql`delete from bicitour_routes where id = ${routeId}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el recorrido.' }, { status: 500 })
  }
  return NextResponse.json({ data: { id: routeId } })
}
