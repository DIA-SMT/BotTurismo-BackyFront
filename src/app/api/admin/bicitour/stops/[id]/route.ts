import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { sanitizeStringArray, type BicitourStop } from '@/lib/bicitour'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const stopId = Number(id)
  if (!Number.isInteger(stopId)) return NextResponse.json({ error: 'Parada inválida.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {}
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 140)
    if (title.length < 2) return NextResponse.json({ error: 'El título es muy corto.' }, { status: 400 })
    payload.title = title
  }
  if (body.description !== undefined) payload.description = String(body.description).trim() || null
  if (body.funFacts !== undefined) payload.fun_facts = sanitizeStringArray(body.funFacts)
  if (body.imageUrls !== undefined) payload.image_urls = sanitizeStringArray(body.imageUrls, 8, 800)
  if (body.audioUrl !== undefined) payload.audio_url = String(body.audioUrl).trim() || null
  if (body.hint !== undefined) payload.hint = String(body.hint).trim() || null
  if (body.hintEnabled !== undefined) payload.hint_enabled = body.hintEnabled === true
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
    }
    payload.lat = lat
    payload.lng = lng
  }
  if (body.radiusM !== undefined) {
    const radius = Number(body.radiusM)
    if (!Number.isInteger(radius) || radius < 10 || radius > 1000) {
      return NextResponse.json({ error: 'El radio debe estar entre 10 y 1000 metros.' }, { status: 400 })
    }
    payload.radius_m = radius
  }
  if (body.position !== undefined) {
    const position = Number(body.position)
    if (!Number.isInteger(position) || position < 1) return NextResponse.json({ error: 'Orden inválido.' }, { status: 400 })
    payload.position = position
  }
  if (body.isDraft !== undefined) payload.is_draft = body.isDraft === true

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 })
  }

  const sql = getSql()
  const [data] = await sql<BicitourStop[]>`
    update bicitour_stops set ${rowValues(sql, payload)} where id = ${stopId} returning *
  `.catch(() => [])
  if (!data) return NextResponse.json({ error: 'No se pudo actualizar la parada.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const stopId = Number(id)
  if (!Number.isInteger(stopId)) return NextResponse.json({ error: 'Parada inválida.' }, { status: 400 })

  const sql = getSql()
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from bicitour_session_stops where stop_id = ${stopId}
  `
  if (count > 0) {
    return NextResponse.json(
      { error: 'La parada ya se usó en sesiones. No se puede eliminar (podés editarla).' },
      { status: 409 },
    )
  }

  try {
    await sql`delete from bicitour_stops where id = ${stopId}`
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la parada.' }, { status: 500 })
  }
  return NextResponse.json({ data: { id: stopId } })
}
