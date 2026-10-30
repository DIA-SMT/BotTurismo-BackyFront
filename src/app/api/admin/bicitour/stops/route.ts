import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { getSql, rowValues } from '@/lib/db'
import { sanitizeStringArray, type BicitourStop } from '@/lib/bicitour'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const routeId = Number(body.routeId)
  const title = String(body.title || '').trim().slice(0, 140)
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isInteger(routeId)) return NextResponse.json({ error: 'Recorrido inválido.' }, { status: 400 })
  if (title.length < 2) return NextResponse.json({ error: 'Ingresá un título para la parada.' }, { status: 400 })
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
  }

  const sql = getSql()
  const [last] = await sql<{ position: number }[]>`
    select position from bicitour_stops where route_id = ${routeId} order by position desc limit 1
  `

  const insertPayload: Record<string, unknown> = {
    route_id: routeId,
    position: Number(last?.position || 0) + 1,
    title,
    description: String(body.description || '').trim() || null,
    fun_facts: sanitizeStringArray(body.funFacts),
    image_urls: sanitizeStringArray(body.imageUrls, 8, 800),
    audio_url: String(body.audioUrl || '').trim() || null,
    hint: String(body.hint || '').trim() || null,
    lat,
    lng,
    radius_m: Number.isInteger(Number(body.radiusM)) && Number(body.radiusM) > 0 ? Number(body.radiusM) : 60,
    is_draft: body.isDraft === true,
  }
  // Columna de la migración v2: solo se envía si el cliente la especifica.
  if (body.hintEnabled !== undefined) insertPayload.hint_enabled = body.hintEnabled !== false

  const [data] = await sql<BicitourStop[]>`
    insert into bicitour_stops ${rowValues(sql, insertPayload)} returning *
  `.catch(() => [])

  if (!data) return NextResponse.json({ error: 'No se pudo crear la parada.' }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
